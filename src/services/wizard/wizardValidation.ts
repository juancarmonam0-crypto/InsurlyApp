import type { FieldValue } from '../../domain/types'
import type { WizardQuestion } from './wizardService'

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateQuestionAnswer(question: WizardQuestion, value: FieldValue): ValidationResult {
  const isEmpty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

  if (question.required && isEmpty) {
    return {
      valid: false,
      error: `"${question.label}" is required to complete this application.`,
    }
  }

  if (isEmpty) {
    return { valid: true }
  }

  if (question.inputType === 'number' || question.inputType === 'currency') {
    const num = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]+/g, ''))
    if (isNaN(num)) {
      return {
        valid: false,
        error: 'Please enter a valid numeric value.',
      }
    }

    if (question.inputType === 'currency' && num < 0) {
      return {
        valid: false,
        error: 'Currency amount cannot be negative.',
      }
    }
  }

  if (question.inputType === 'date') {
    const str = String(value)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str) && isNaN(Date.parse(str))) {
      return {
        valid: false,
        error: 'Please provide a valid date (YYYY-MM-DD).',
      }
    }
  }

  return { valid: true }
}
