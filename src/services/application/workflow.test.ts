import { describe, expect, test } from 'vitest'
import { buildAcord125Preview } from '../../adapters/applications/acord125/adapter'
import { getApplicationDefinition } from '../../domain/applicationDefinitions'
import { demoApplication } from '../../data/mock/insurly'
import { calculateReadiness } from './readinessEngine'
import { computeCompletion, getWizardQuestions } from './requirementsEngine'
import {
  answerRequirement,
  applyCustomerReviewChange,
  confirmCustomerReview,
  markGenerated,
  processDocumentIntake,
  recalculateApplication,
  resolveApplicationConflict,
  verifyApplication,
} from './workflow'
import { valuesEquivalent } from '../conflicts/normalization'

const createApplication = () => recalculateApplication(structuredClone(demoApplication))

const getDefinition = (application = createApplication()) =>
  getApplicationDefinition(application.definitionId, application.definitionVersion)

const completeRequiredQuestions = () => {
  let application = createApplication()
  application = answerRequirement(application, 'business.yearsInBusiness', 6)
  application = answerRequirement(application, 'business.fein', '92-1845601')
  application = answerRequirement(application, 'currentInsurance.effectiveDate', '2027-01-01')
  return application
}

describe('requirements and wizard', () => {
  test('application retains definition id and version through workflow changes', () => {
    let application = createApplication()
    application = answerRequirement(application, 'business.yearsInBusiness', 6)
    application = answerRequirement(application, 'business.fein', '92-1845601')
    application = applyCustomerReviewChange(application, 'business.annualRevenue', 150000)

    expect(application.definitionId).toBe(demoApplication.definitionId)
    expect(application.definitionVersion).toBe(demoApplication.definitionVersion)
  })

  test('completion derives from applicable required requirements', () => {
    const application = createApplication()
    const completion = computeCompletion(application, getDefinition(application))

    expect(completion).toBe(57)
  })

  test('wizard returns only unresolved applicable requirements and does not ask known values again', () => {
    const application = createApplication()
    const questions = getWizardQuestions(application, getDefinition(application))

    expect(questions.map((question) => question.canonicalField)).toEqual([
      'business.yearsInBusiness',
      'business.fein',
      'currentInsurance.effectiveDate',
    ])
    expect(questions.some((question) => question.canonicalField === 'business.annualRevenue')).toBe(false)
  })
})

describe('normalization and conflicts', () => {
  test('normalization compares equivalent numeric formats', () => {
    expect(valuesEquivalent('$300,000', '300000')).toBe(true)
    expect(valuesEquivalent('300000', 300000)).toBe(true)
  })

  test('customer edit preserves original evidence, selects declaration, and creates a material conflict', () => {
    const application = applyCustomerReviewChange(createApplication(), 'business.annualRevenue', 150000)
    const revenueEvidence = application.profile.fieldProvenance.filter((item) => item.canonicalField === 'business.annualRevenue')
    const conflict = application.conflicts.find((item) => item.canonicalField === 'business.annualRevenue')
    const fieldState = application.fieldStates.find((item) => item.canonicalField === 'business.annualRevenue')

    expect(revenueEvidence.some((item) => item.sourceType === 'document_ai' && item.value === 300000)).toBe(true)
    expect(revenueEvidence.some((item) => item.sourceType === 'customer_answer' && item.value === 150000)).toBe(true)
    expect(fieldState?.selectedValue).toBe(150000)
    expect(conflict?.material).toBe(true)
    expect(conflict?.status).toBe('open')
  })

  test('repeating the same customer answer does not duplicate provenance history', () => {
    let application = createApplication()
    application = answerRequirement(application, 'business.fein', '92-1845601')
    const firstCount = application.profile.fieldProvenance.filter((item) => item.canonicalField === 'business.fein' && item.sourceType === 'customer_answer').length

    application = answerRequirement(application, 'business.fein', '92-1845601')
    const secondCount = application.profile.fieldProvenance.filter((item) => item.canonicalField === 'business.fein' && item.sourceType === 'customer_answer').length

    expect(firstCount).toBe(1)
    expect(secondCount).toBe(1)
  })

  test('conflicts resolve by id and correct_value uses caller supplied value', () => {
    let application = applyCustomerReviewChange(createApplication(), 'business.annualRevenue', 150000)
    const conflictId = application.conflicts[0]?.id

    expect(conflictId).toBeTruthy()

    application = resolveApplicationConflict(application, conflictId!, 'correct_value', 275000)

    expect(application.profile.business.annualRevenue).toBe(275000)
    expect(application.fieldStates.find((item) => item.canonicalField === 'business.annualRevenue')?.selectedValue).toBe(275000)
    expect(application.conflicts.find((item) => item.id === conflictId)?.status).toBe('resolved')
    expect(application.profile.fieldProvenance.some((item) => item.sourceType === 'broker' && item.value === 275000)).toBe(true)
  })
})

  test('document intake updates preferred channel, current policy document, and related provenance timestamp', () => {
    const application = createApplication()
    const beforeTimestamp = application.profile.fieldProvenance.find((item) => item.sourceDocument === 'CurrentPolicy.pdf')?.timestamp
    const updated = processDocumentIntake(application)

    expect(updated.profile.preferredChannel).toBe('document_upload')
    expect(updated.profile.documents.find((item) => item.type === 'Current Policy')?.status).toBe('complete')
    expect(updated.profile.fieldProvenance.find((item) => item.sourceDocument === 'CurrentPolicy.pdf')?.customerConfirmed).toBe(false)
    expect(updated.profile.fieldProvenance.find((item) => item.sourceDocument === 'CurrentPolicy.pdf')?.timestamp).not.toBe(beforeTimestamp)
  })

describe('readiness and status', () => {
  test('required customer confirmation blocks readiness', () => {
    const application = completeRequiredQuestions()
    const readiness = calculateReadiness(application, getDefinition(application))

    expect(readiness.ready).toBe(false)
    expect(readiness.missingConfirmations.map((item) => item.requirement.canonicalField)).toEqual([
      'business.legalName',
      'business.annualRevenue',
      'business.employeeCount',
      'currentInsurance.effectiveDate',
    ])
    expect(application.status).toBe('customer_review')
  })

  test('request_clarification remains a readiness blocker and unresolved material conflict blocks readiness', () => {
    let application = completeRequiredQuestions()
    application = confirmCustomerReview(application)
    application = applyCustomerReviewChange(application, 'business.annualRevenue', 150000)
    application = resolveApplicationConflict(application, application.conflicts[0]!.id, 'request_clarification')
    const readiness = calculateReadiness(application, getDefinition(application))

    expect(readiness.ready).toBe(false)
    expect(readiness.unresolvedConflicts).toHaveLength(1)
    expect(readiness.unresolvedConflicts[0]?.status).toBe('clarification_requested')
    expect(application.status).toBe('broker_review')
  })

  test('required broker verification blocks readiness when applicable and status becomes ready_to_submit after blockers clear', () => {
    let application = completeRequiredQuestions()
    application = confirmCustomerReview(application)
    let readiness = calculateReadiness(application, getDefinition(application))

    expect(readiness.ready).toBe(false)
    expect(readiness.missingBrokerVerifications.map((item) => item.requirement.canonicalField)).toEqual([
      'business.annualRevenue',
      'business.fein',
    ])
    expect(application.status).toBe('broker_review')

    application = verifyApplication(application)
    readiness = calculateReadiness(application, getDefinition(application))

    expect(readiness.ready).toBe(true)
    expect(application.status).toBe('ready_to_submit')
  })
})

describe('ACORD preview and generation', () => {
  test('ACORD counts derive from actual mapping results', () => {
    const preview = buildAcord125Preview(createApplication())
    const counts = preview.rows.reduce(
      (result, row) => {
        result[row.status] += 1
        return result
      },
      { mapped: 0, missing: 0, review_required: 0 },
    )

    expect(preview.mappedCount).toBe(counts.mapped)
    expect(preview.missingCount).toBe(counts.missing)
    expect(preview.reviewRequiredCount).toBe(counts.review_required)
  })

  test('generate application does not transition to submitted', () => {
    let application = completeRequiredQuestions()
    application = confirmCustomerReview(application)
    application = verifyApplication(application)
    application = markGenerated(application)

    expect(application.generatedAt).toBeTruthy()
    expect(application.status).toBe('ready_to_submit')
  })

  test('generate application preserves an existing terminal status', () => {
    const application = markGenerated({
      ...createApplication(),
      status: 'submitted',
    })

    expect(application.generatedAt).toBeTruthy()
    expect(application.status).toBe('submitted')
  })
})
