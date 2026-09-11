import { describe, expect, it } from 'vitest'
import { getQuestionRenderer, QUESTION_RENDERER_REGISTRY } from './questionRendererRegistry'
import { validateQuestionAnswer } from './wizardValidation'
import type { WizardQuestion } from './wizardService'

describe('Smart Wizard Question Renderer & Validation (OpenForm Pattern)', () => {
  it('provides registered question renderers for all input types', () => {
    expect(getQuestionRenderer('text')).toBeDefined()
    expect(getQuestionRenderer('number')).toBeDefined()
    expect(getQuestionRenderer('currency')).toBeDefined()
    expect(getQuestionRenderer('date')).toBeDefined()
    expect(getQuestionRenderer('boolean')).toBeDefined()
    expect(getQuestionRenderer('select')).toBeDefined()
  })

  it('validates required fields', () => {
    const question: WizardQuestion = {
      id: 'q1',
      requirementId: 'req1',
      canonicalField: 'business.legalName',
      label: 'Legal Business Name',
      inputType: 'text',
      section: 'business',
      required: true,
      profileReusable: true,
    }

    const emptyResult = validateQuestionAnswer(question, '')
    expect(emptyResult.valid).toBe(false)
    expect(emptyResult.error).toContain('is required')

    const validResult = validateQuestionAnswer(question, 'Acme Construction LLC')
    expect(validResult.valid).toBe(true)
    expect(validResult.error).toBeUndefined()
  })

  it('validates currency and numeric inputs', () => {
    const numberQuestion: WizardQuestion = {
      id: 'q2',
      requirementId: 'req2',
      canonicalField: 'business.annualRevenue',
      label: 'Annual Revenue',
      inputType: 'currency',
      section: 'business',
      required: true,
      profileReusable: true,
    }

    expect(validateQuestionAnswer(numberQuestion, -500).valid).toBe(false)
    expect(validateQuestionAnswer(numberQuestion, 'not-a-number').valid).toBe(false)
    expect(validateQuestionAnswer(numberQuestion, 1500000).valid).toBe(true)
  })

  it('validates date format inputs', () => {
    const dateQuestion: WizardQuestion = {
      id: 'q3',
      requirementId: 'req3',
      canonicalField: 'application.desiredEffectiveDate',
      label: 'Effective Date',
      inputType: 'date',
      section: 'coverage',
      required: false,
      profileReusable: false,
    }

    expect(validateQuestionAnswer(dateQuestion, 'invalid-date').valid).toBe(false)
    expect(validateQuestionAnswer(dateQuestion, '2026-10-01').valid).toBe(true)
  })
})
