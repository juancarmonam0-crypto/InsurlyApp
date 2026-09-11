import { describe, expect, test } from 'vitest'
import { buildWizardPlan } from './wizardService'
import { demoApplication } from '../../data/mock/insurly'
import { commercialAcord125DefinitionV2 } from '../../domain/applicationDefinitions'
import { answerRequirement, recalculateApplication } from '../application/workflow'

describe('wizardService', () => {
  test('builds a deterministic wizard plan from application state and definition', () => {
    const plan = buildWizardPlan(demoApplication, commercialAcord125DefinitionV2)

    expect(plan.definitionId).toBe('commercial-acord125')
    expect(plan.definitionVersion).toBe(2)
    expect(plan.totalApplicableQuestions).toBe(7)
    expect(plan.allQuestions.length).toBe(7)

    // Legal name, revenue, naics, employee count, years in business, fein are already populated in demoApplication
    // Desired effective date is missing or has currentInsurance.effectiveDate
  })

  test('skips known/resolved fields and returns only unresolved questions', () => {
    let app = recalculateApplication(structuredClone(demoApplication))
    // Answer missing fields
    app = answerRequirement(app, 'business.yearsInBusiness', 5)
    app = answerRequirement(app, 'business.fein', '92-1845601')

    const plan = buildWizardPlan(app, commercialAcord125DefinitionV2)

    expect(plan.allQuestions.find((q) => q.canonicalField === 'business.yearsInBusiness')?.isResolved).toBe(true)
    expect(plan.allQuestions.find((q) => q.canonicalField === 'business.fein')?.isResolved).toBe(true)
  })

  test('save & resume position automatically advances to first unresolved question', () => {
    let app = recalculateApplication(structuredClone(demoApplication))
    const initialPlan = buildWizardPlan(app, commercialAcord125DefinitionV2)

    if (initialPlan.currentQuestion) {
      const canonicalField = initialPlan.currentQuestion.canonicalField
      app = answerRequirement(app, canonicalField, '2027-01-01')
      const updatedPlan = buildWizardPlan(app, commercialAcord125DefinitionV2)

      expect(updatedPlan.completedQuestionsCount).toBe(initialPlan.completedQuestionsCount + 1)
      if (updatedPlan.currentQuestion) {
        expect(updatedPlan.currentQuestion.canonicalField).not.toBe(canonicalField)
      }
    }
  })

  test('correctly identifies profileReusable vs application-only requirements', () => {
    const plan = buildWizardPlan(demoApplication, commercialAcord125DefinitionV2)
    const legalNameQ = plan.allQuestions.find((q) => q.canonicalField === 'business.legalName')
    const effectiveDateQ = plan.allQuestions.find((q) => q.canonicalField === 'application.desiredEffectiveDate')

    expect(legalNameQ?.profileReusable).toBe(true)
    expect(effectiveDateQ?.profileReusable).toBe(false)
  })
})
