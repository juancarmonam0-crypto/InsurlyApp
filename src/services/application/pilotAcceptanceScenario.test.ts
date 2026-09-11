import { describe, expect, test } from 'vitest'
import {
  commercialGeneralLiabilityDefinitionV2,
} from '../../domain/applicationDefinitions'
import { demoCustomer, demoApplication, agencyConfig } from '../../data/mock/insurly'
import { createNewApplicationFromProfile } from '../profileMappingEngine'
import { processDocumentIntake } from './workflow'
import { getWizardQuestions } from './requirementsEngine'
import {
  answerRequirement,
  confirmCustomerReview,
  resolveApplicationConflict,
  verifyApplication,
  applyCustomerReviewChange,
} from './workflow'
import { calculateReadiness } from './readinessEngine'
import { prepareApplicationPackage } from './snapshotService'
import {
  promoteConfirmedApplicationFactsToProfile,
  extractFactsFromCustomerProfile,
} from '../customerProfileService'
import type { ApplicationRecord, ConflictRecord, DocumentRecord } from '../../domain/types'

describe('INSURLY V0.7 — End-to-End Commercial General Liability Pilot Workflow', () => {
  test('executes all 20 lifecycle steps deterministically through real domain services', () => {
    const pilotDef = commercialGeneralLiabilityDefinitionV2

    // -------------------------------------------------------------------------
    // Step 1: Start a NEW Commercial General Liability V2 application from Customer Profile
    // -------------------------------------------------------------------------
    const customer = structuredClone(demoCustomer)
    let application: ApplicationRecord = createNewApplicationFromProfile(
      customer,
      pilotDef.id,
      pilotDef.version,
      agencyConfig.id,
    )

    expect(application.definitionId).toBe('commercial-general-liability')
    expect(application.definitionVersion).toBe(2)
    expect(application.id).toBeTruthy()

    // -------------------------------------------------------------------------
    // Step 2: Safely prefill reusable profile facts
    // -------------------------------------------------------------------------
    expect(application.profile.business.legalName).toBe('Cedar Ridge Services LLC')
    expect(application.profile.business.entityType).toBe('Texas LLC')
    expect(application.profile.business.naicsCode).toBe('561730')
    expect(application.profile.locations.length).toBeGreaterThan(0)
    expect(application.profile.people.length).toBeGreaterThan(0)

    const initialPrefillQuestions = getWizardQuestions(application, pilotDef)
    expect(initialPrefillQuestions.some((q) => q.canonicalField === 'business.legalName')).toBe(false)
    expect(initialPrefillQuestions.some((q) => q.canonicalField === 'business.entityType')).toBe(false)

    // -------------------------------------------------------------------------
    // Step 3: Confirm historical application state does NOT leak into the new application
    // -------------------------------------------------------------------------
    expect(application.id).not.toBe(demoApplication.id)
    expect(application.generatedAt).toBeUndefined()
    expect(application.status).not.toBe('ready_to_submit')
    expect(application.status).not.toBe('bound')
    expect(application.status).not.toBe('declined')
    expect(application.conflicts.length).toBe(0)

    // -------------------------------------------------------------------------
    // Step 4: Process Current Policy through the existing V0.6 Document Intelligence pipeline
    // -------------------------------------------------------------------------
    const doc = application.profile.documents.find(
      (d: DocumentRecord) => d.id === 'doc-1' || d.fileName.includes('CurrentPolicy'),
    )
    expect(doc).toBeDefined()
    if (doc) {
      application = processDocumentIntake(application)
    }

    // -------------------------------------------------------------------------
    // Step 5: Accept safe high-confidence evidence into empty application fields
    // -------------------------------------------------------------------------
    const limitsFieldState = application.fieldStates.find(
      (f) => f.canonicalField === 'currentInsurance.limits',
    )
    expect(String(limitsFieldState?.selectedValue)).toContain('$1,000,000')
    expect(limitsFieldState?.selectedEvidenceId).toBeTruthy()

    // -------------------------------------------------------------------------
    // Step 6: Create conflicts for materially different evidence without overwriting protected truth
    // -------------------------------------------------------------------------
    // Customer explicitly states 150,000 revenue while doc intelligence has 300,000
    application = applyCustomerReviewChange(application, 'business.annualRevenue', 150000)
    const revConflict = application.conflicts.find(
      (c: ConflictRecord) => c.canonicalField === 'business.annualRevenue',
    )
    expect(revConflict).toBeDefined()
    expect(revConflict?.material).toBe(true)
    expect(revConflict?.status).toBe('open')
    // Customer protected truth is preserved as current selected value
    const revFieldState = application.fieldStates.find(
      (f) => f.canonicalField === 'business.annualRevenue',
    )
    expect(revFieldState?.selectedValue).toBe(150000)

    // -------------------------------------------------------------------------
    // Step 7: Rebuild Smart Wizard and ask only remaining unresolved required questions
    // -------------------------------------------------------------------------
    let wizardQuestions = getWizardQuestions(application, pilotDef)
    expect(wizardQuestions.length).toBeGreaterThan(0)
    // Pre-filled legal name and document-derived policy limits should NOT be asked
    expect(wizardQuestions.some((q) => q.canonicalField === 'business.legalName')).toBe(false)
    expect(wizardQuestions.some((q) => q.canonicalField === 'currentInsurance.limits')).toBe(false)

    // -------------------------------------------------------------------------
    // Step 8: Answer remaining wizard questions through the real application workflow
    // -------------------------------------------------------------------------
    let iterationGuard = 25
    while (getWizardQuestions(application, pilotDef).length > 0 && iterationGuard > 0) {
      iterationGuard--
      const q = getWizardQuestions(application, pilotDef)[0]!
      if (q.canonicalField === 'business.fein') {
        application = answerRequirement(application, q.canonicalField, '92-1845601')
      } else if (q.canonicalField === 'business.yearsInBusiness') {
        application = answerRequirement(application, q.canonicalField, 5)
      } else if (q.canonicalField === 'business.description') {
        application = answerRequirement(application, q.canonicalField, 'Artisanal engineering & coffee roastery')
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
        application = answerRequirement(application, q.canonicalField, 'Commercial testing facility and service fleet')
      } else {
        application = answerRequirement(application, q.canonicalField, 'Confirmed response')
      }
    }
    expect(getWizardQuestions(application, pilotDef).length).toBe(0)

    // -------------------------------------------------------------------------
    // Step 9: Perform required customer confirmations
    // -------------------------------------------------------------------------
    application = confirmCustomerReview(application)
    expect(application.customerConfirmed).toBe(true)

    // -------------------------------------------------------------------------
    // Step 10: Promote only eligible confirmed reusable facts back to Customer Profile
    // -------------------------------------------------------------------------
    const updatedCustomer = promoteConfirmedApplicationFactsToProfile(customer, application, pilotDef)
    const promotedFacts = extractFactsFromCustomerProfile(updatedCustomer)
    expect(promotedFacts.length).toBeGreaterThan(0)
    expect(promotedFacts.some((f) => f.fieldKey === 'business.fein')).toBe(true)

    // -------------------------------------------------------------------------
    // Step 11: Reach customer-complete / waiting-for-broker state without claiming carrier submission
    // -------------------------------------------------------------------------
    expect(application.customerConfirmed).toBe(true)
    expect(application.status).toBe('broker_review')
    expect(application.status).not.toBe('ready_to_submit')
    expect(application.status).not.toBe('bound')

    // -------------------------------------------------------------------------
    // Step 12: Broker sees missing requirements, confirmations, verifications, conflicts and provenance
    // -------------------------------------------------------------------------
    let readiness = calculateReadiness(application, pilotDef)
    expect(readiness.ready).toBe(false)
    expect(readiness.unresolvedConflicts.length).toBeGreaterThan(0)
    expect(readiness.missingBrokerVerifications.length).toBeGreaterThan(0)
    expect(application.profile.fieldProvenance.length).toBeGreaterThan(0)

    // -------------------------------------------------------------------------
    // Step 16 (Interleaved Verification): Attempting preparation before readiness must fail
    // -------------------------------------------------------------------------
    const prematurePrepResult = prepareApplicationPackage(application)
    expect(prematurePrepResult.success).toBe(false)
    if (!prematurePrepResult.success) {
      expect(prematurePrepResult.blockers.length).toBeGreaterThan(0)
      expect(prematurePrepResult.error).toContain('not ready')
    }

    // -------------------------------------------------------------------------
    // Step 13: Resolve blocking conflict through the existing conflict engine
    // -------------------------------------------------------------------------
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
    expect(application.conflicts.every((c) => c.status === 'resolved')).toBe(true)

    // -------------------------------------------------------------------------
    // Step 14: Perform required broker verification
    // -------------------------------------------------------------------------
    application = verifyApplication(application)
    expect(application.brokerVerified).toBe(true)

    // -------------------------------------------------------------------------
    // Step 15: Reach ready_to_submit ONLY through the deterministic readiness engine
    // (Notice: status is NOT manually assigned!)
    // -------------------------------------------------------------------------
    readiness = calculateReadiness(application, pilotDef)
    expect(readiness.ready).toBe(true)
    expect(readiness.blockers.length).toBe(0)
    expect(application.status).toBe('ready_to_submit')

    // -------------------------------------------------------------------------
    // Step 17: Prepare the application package using the ACORD mapping architecture
    // -------------------------------------------------------------------------
    const prepResult1 = prepareApplicationPackage(application, 'broker-lead-auditor')
    expect(prepResult1.success).toBe(true)
    if (!prepResult1.success) return

    expect(prepResult1.acordPreview.mappedCount).toBeGreaterThan(0)
    expect(prepResult1.acordPreview.rows.some((r) => r.canonicalField === 'business.legalName')).toBe(true)
    // Generation/preparation MUST NOT set status to submitted
    expect(prepResult1.application.status).toBe('ready_to_submit')
    expect(prepResult1.application.status).not.toBe('bound')

    // -------------------------------------------------------------------------
    // Step 18: Create immutable ApplicationSnapshot from the exact prepared state
    // -------------------------------------------------------------------------
    const snapshot1 = prepResult1.snapshot
    expect(snapshot1.snapshotHash).toBeTruthy()
    expect(snapshot1.snapshotHash.startsWith('sha256-')).toBe(true)
    expect(snapshot1.application_id).toBe(application.id)
    expect(snapshot1.snapshot.fieldStates.length).toBe(prepResult1.application.fieldStates.length)
    expect(snapshot1.snapshot.readiness.ready).toBe(true)

    const initialSnapshotRevenue = snapshot1.snapshot.fieldStates.find(
      (f) => f.canonicalField === 'business.annualRevenue',
    )?.selectedValue
    expect(initialSnapshotRevenue).toBe(150000)

    // -------------------------------------------------------------------------
    // Step 19: Mutate later working/profile state and prove Snapshot #1 remains unchanged
    // -------------------------------------------------------------------------
    let mutatedApp = applyCustomerReviewChange(prepResult1.application, 'business.annualRevenue', 225000)
    customer.profile.business.legalName = 'Cedar Ridge New Parent Entity LLC'

    // Snapshot #1 payload and hash must remain completely identical
    const snapshot1RevenueAfterMutation = snapshot1.snapshot.fieldStates.find(
      (f) => f.canonicalField === 'business.annualRevenue',
    )?.selectedValue
    expect(snapshot1RevenueAfterMutation).toBe(150000)
    expect(snapshot1.snapshot.profile.business.legalName).toBe('Cedar Ridge Services LLC')
    expect(mutatedApp.fieldStates.find((f) => f.canonicalField === 'business.annualRevenue')?.selectedValue).toBe(225000)

    // -------------------------------------------------------------------------
    // Step 20: Prepare again and prove Snapshot #2 is created without mutating Snapshot #1
    // -------------------------------------------------------------------------
    // Resolve any newly triggered conflict from the revenue mutation and verify
    const newRevConflict = mutatedApp.conflicts.find((c: ConflictRecord) => c.status === 'open')
    if (newRevConflict) {
      mutatedApp = resolveApplicationConflict(mutatedApp, newRevConflict.id, 'accept_customer', 225000)
    }
    mutatedApp = verifyApplication(mutatedApp)

    const prepResult2 = prepareApplicationPackage(mutatedApp, 'broker-lead-auditor')
    expect(prepResult2.success).toBe(true)
    if (!prepResult2.success) return

    const snapshot2 = prepResult2.snapshot
    expect(snapshot2.id).not.toBe(snapshot1.id)
    expect(snapshot2.snapshotHash).not.toBe(snapshot1.snapshotHash)
    expect(
      snapshot2.snapshot.fieldStates.find((f) => f.canonicalField === 'business.annualRevenue')?.selectedValue,
    ).toBe(225000)
    // Confirm Snapshot #1 was NOT mutated
    expect(
      snapshot1.snapshot.fieldStates.find((f) => f.canonicalField === 'business.annualRevenue')?.selectedValue,
    ).toBe(150000)
    // Neither preparation sets status to submitted
    expect(prepResult2.application.status).toBe('ready_to_submit')
    expect(prepResult2.application.status).not.toBe('bound')
    expect(prepResult2.application.status).not.toBe('submitted')
  })
})
