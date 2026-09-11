import { describe, expect, test } from 'vitest'
import {
  commercialGeneralLiabilityDefinitionV2,
} from '../../domain/applicationDefinitions'
import { demoCustomer, agencyConfig } from '../../data/mock/insurly'
import { createNewApplicationFromProfile } from '../profileMappingEngine'
import { processDocumentIntake } from './workflow'
import { getWizardQuestions } from './requirementsEngine'
import {
  answerRequirement,
  confirmCustomerReview,
  resolveApplicationConflict,
  verifyApplication,
  markGenerated,
  applyCustomerReviewChange,
} from './workflow'
import { calculateReadiness } from './readinessEngine'
import { createApplicationSnapshot } from './snapshotService'
import { promoteConfirmedApplicationFactsToProfile, extractFactsFromCustomerProfile } from '../customerProfileService'
import { buildAcord125Preview } from '../../adapters/applications/acord125/adapter'
import type { ApplicationRecord, ConflictRecord, DocumentRecord } from '../../domain/types'

describe('V0.7 Pilot Acceptance Scenario — End-to-End Commercial General Liability Workflow', () => {
  test('executes the full pilot workflow across all stages deterministically', () => {
    // 1. Broker / Customer has reusable canonical profile facts
    expect(demoCustomer.profile.business.legalName).toBe('Cedar Ridge Services LLC')
    expect(demoCustomer.profile.locations.length).toBeGreaterThan(0)
    expect(demoCustomer.profile.people.length).toBeGreaterThan(0)

    // 2. New Commercial General Liability application is initialized
    const pilotDef = commercialGeneralLiabilityDefinitionV2
    let application: ApplicationRecord = createNewApplicationFromProfile(
      demoCustomer,
      pilotDef.id,
      pilotDef.version,
      agencyConfig.id,
    )

    expect(application.definitionId).toBe('commercial-general-liability')
    expect(application.definitionVersion).toBe(2)
    expect(['draft', 'collecting_information']).toContain(application.status)

    // 3. Profile prefill reduces required missing fields
    const prefillQuestions = getWizardQuestions(application, pilotDef)
    // Legal name, entity type, DBA, NAICS, employees, contact, location were prefilled from profile
    expect(prefillQuestions.some((q) => q.canonicalField === 'business.legalName')).toBe(false)
    expect(prefillQuestions.some((q) => q.canonicalField === 'business.entityType')).toBe(false)

    // 4. Current Policy document is processed through Document Intelligence
    const doc = application.profile.documents.find((d: DocumentRecord) => d.id === 'doc-1' || d.fileName.includes('CurrentPolicy'))
    expect(doc).toBeDefined()
    if (doc) {
      application = processDocumentIntake(application)
    }

    // 5. Valid document evidence populates additional empty application fields safely
    const limitsFieldState = application.fieldStates.find((f) => f.canonicalField === 'currentInsurance.limits')
    expect(String(limitsFieldState?.selectedValue)).toContain('$1,000,000')

    // 6. Conflicting document evidence creates conflict without overwriting protected truth
    // Simulate customer declared revenue edit to verify conflict creation without silent overwriting
    application = applyCustomerReviewChange(application, 'business.annualRevenue', 150000)
    const revConflict = application.conflicts.find((c: ConflictRecord) => c.canonicalField === 'business.annualRevenue')
    expect(revConflict).toBeDefined()
    expect(revConflict?.material).toBe(true)
    expect(revConflict?.status).toBe('open')

    // 7 & 8. Wizard iteratively asks unresolved questions (including dependent questions)
    let maxIterations = 20
    while (getWizardQuestions(application, pilotDef).length > 0 && maxIterations > 0) {
      maxIterations--
      const q = getWizardQuestions(application, pilotDef)[0]!
      if (q.canonicalField === 'business.fein') {
        application = answerRequirement(application, q.canonicalField, '92-1845601')
      } else if (q.canonicalField === 'business.yearsInBusiness') {
        application = answerRequirement(application, q.canonicalField, 5)
      } else if (q.canonicalField === 'business.description') {
        application = answerRequirement(application, q.canonicalField, 'Artisanal coffee roasting and distribution')
      } else if (q.canonicalField === 'application.desiredEffectiveDate') {
        application = answerRequirement(application, q.canonicalField, '2026-06-01')
      } else if (q.canonicalField === 'loss.description') {
        application = answerRequirement(application, q.canonicalField, 'No prior losses in past 5 years')
      } else if (q.canonicalField === 'gl.subcontractorUsage') {
        application = answerRequirement(application, q.canonicalField, true)
      } else if (q.canonicalField === 'gl.subcontractorPercent') {
        application = answerRequirement(application, q.canonicalField, 25)
      } else if (q.canonicalField === 'gl.residentialCommercialMix') {
        application = answerRequirement(application, q.canonicalField, '80% Commercial / 20% Residential')
      } else if (q.canonicalField === 'gl.operationsDescription') {
        application = answerRequirement(application, q.canonicalField, 'Warehouse roasting facility and retail coffee bar')
      } else {
        application = answerRequirement(application, q.canonicalField, 'Confirmed answer')
      }
    }

    expect(getWizardQuestions(application, pilotDef).length).toBe(0)

    // 9. Customer review confirms required material facts
    application = confirmCustomerReview(application)
    expect(application.customerConfirmed).toBe(true)

    // 10. Eligible facts are promoted safely to Customer Profile
    const updatedCustomer = promoteConfirmedApplicationFactsToProfile(demoCustomer, application, pilotDef)
    const promotedFacts = extractFactsFromCustomerProfile(updatedCustomer)
    expect(promotedFacts.length).toBeGreaterThan(0)

    // 11. Customer portion becomes complete
    expect(application.customerConfirmed).toBe(true)

    // 12. Broker sees remaining verification/conflict blockers
    let readiness = calculateReadiness(application, pilotDef)
    expect(readiness.ready).toBe(false)
    expect(readiness.blockers.some((b) => b.type === 'conflict' || b.type === 'broker_verification')).toBe(true)
    expect(readiness.unresolvedConflicts.length).toBeGreaterThan(0)

    // 13. Broker resolves blocking conflict
    const openConflict = application.conflicts.find((c: ConflictRecord) => c.status === 'open')
    expect(openConflict).toBeDefined()
    if (openConflict) {
      application = resolveApplicationConflict(
        application,
        openConflict.id,
        'accept_customer',
        150000,
      )
    }

    // 14. Broker verifies broker-required fields
    application = verifyApplication(application)

    // 15. Application reaches ready_to_submit
    readiness = calculateReadiness(application, pilotDef)
    expect(readiness.ready).toBe(true)
    expect(readiness.blockers.length).toBe(0)
    expect(application.status).toBe('ready_to_submit')

    // 16. Prepared application snapshot is generated
    const finalApp = markGenerated(application)
    const acord = buildAcord125Preview(finalApp)
    const snapshot = createApplicationSnapshot(finalApp, readiness, acord)

    expect(snapshot).toBeDefined()
    expect(snapshot.snapshotHash).toBeTruthy()
    expect(snapshot.application_id).toBe(application.id)
    expect(finalApp.status).toBe('ready_to_submit')

    // 17. ACORD 125 mapping output is populated
    expect(acord.mappedCount).toBeGreaterThan(0)
    expect(acord.rows.some((r) => r.canonicalField === 'business.legalName' && r.status === 'mapped')).toBe(true)
  })
})
