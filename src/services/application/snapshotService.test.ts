import { describe, expect, test } from 'vitest'
import { buildAcord125Preview } from '../../adapters/applications/acord125/adapter'
import { demoApplication, demoCustomer } from '../../data/mock/insurly'
import { calculateReadiness } from './readinessEngine'
import { getApplicationDefinition } from '../../domain/applicationDefinitions'
import {
  answerRequirement,
  applyCustomerReviewChange,
  confirmCustomerReview,
  markGenerated,
  recalculateApplication,
  resolveApplicationConflict,
  verifyApplication,
} from './workflow'
import { createApplicationSnapshot, hashSnapshotPayload } from './snapshotService'

const readyApplication = () => {
  let application = recalculateApplication(structuredClone(demoApplication))
  application = answerRequirement(application, 'business.yearsInBusiness', 6)
  application = answerRequirement(application, 'business.fein', '92-1845601')
  application = answerRequirement(application, 'application.desiredEffectiveDate', '2027-01-01')
  application = answerRequirement(application, 'currentInsurance.effectiveDate', '2027-01-01')
  application = confirmCustomerReview(application)
  application = verifyApplication(application)
  application = markGenerated(application)
  return application
}

const readinessFor = (application = readyApplication()) =>
  calculateReadiness(application, getApplicationDefinition(application.definitionId, application.definitionVersion))

describe('snapshot service', () => {
  test('creating a snapshot copies current working state and readiness/completion', () => {
    const application = readyApplication()
    const snapshot = createApplicationSnapshot(application, readinessFor(application), buildAcord125Preview(application))

    expect(snapshot.snapshot.completion).toBe(application.completion)
    expect(snapshot.snapshot.readiness.ready).toBe(true)
    expect(snapshot.snapshot.definitionVersion).toBe(application.definitionVersion)
    expect(snapshot.snapshot.fieldStates).toEqual(application.fieldStates)
  })

  test('changing working field state after snapshot does not mutate old snapshot', () => {
    const application = readyApplication()
    const snapshot = createApplicationSnapshot(application, readinessFor(application), buildAcord125Preview(application))
    const changedApplication = applyCustomerReviewChange(application, 'business.annualRevenue', 150000)

    expect(snapshot.snapshot.fieldStates.find((item) => item.canonicalField === 'business.annualRevenue')?.selectedValue).toBe(300000)
    expect(changedApplication.fieldStates.find((item) => item.canonicalField === 'business.annualRevenue')?.selectedValue).toBe(150000)
  })

  test('changing customer profile after snapshot does not mutate old snapshot', () => {
    const application = readyApplication()
    const customer = structuredClone(demoCustomer)
    const snapshot = createApplicationSnapshot(application, readinessFor(application), buildAcord125Preview(application))

    customer.profile.business.legalName = 'Changed Customer Name LLC'

    expect(snapshot.snapshot.profile.business.legalName).toBe('Cedar Ridge Services LLC')
  })

  test('snapshot preserves provenance and resolved conflicts', () => {
    let application = recalculateApplication(structuredClone(demoApplication))
    application = answerRequirement(application, 'business.yearsInBusiness', 6)
    application = answerRequirement(application, 'business.fein', '92-1845601')
    application = answerRequirement(application, 'currentInsurance.effectiveDate', '2027-01-01')
    application = confirmCustomerReview(application)
    application = applyCustomerReviewChange(application, 'business.annualRevenue', 150000)
    application = resolveApplicationConflict(application, application.conflicts[0]!.id, 'correct_value', 275000)
    application = verifyApplication(application)
    application = markGenerated(application)

    const snapshot = createApplicationSnapshot(application, readinessFor(application), buildAcord125Preview(application))

    expect(snapshot.snapshot.provenance.some((item) => item.sourceType === 'document_ai' && item.value === 300000)).toBe(true)
    expect(snapshot.snapshot.provenance.some((item) => item.sourceType === 'broker' && item.value === 275000)).toBe(true)
    expect(snapshot.snapshot.conflicts[0]?.resolution?.type).toBe('correct_value')
  })

  test('deterministic snapshot hashing matches equivalent content', () => {
    const application = readyApplication()
    const payload = createApplicationSnapshot(application, readinessFor(application), buildAcord125Preview(application)).snapshot
    const equivalent = structuredClone(payload)

    expect(hashSnapshotPayload(payload)).toBe(hashSnapshotPayload(equivalent))
  })
})
