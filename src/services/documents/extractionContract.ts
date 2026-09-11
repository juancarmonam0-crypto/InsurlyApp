import type { DocumentExtractionResult, ExtractedCandidateFact } from '../../domain/types'

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export const validateCandidateFact = (fact: ExtractedCandidateFact): ValidationResult => {
  const errors: string[] = []

  if (!fact.id) errors.push('Candidate fact missing required field "id"')
  if (!fact.rawLabel) errors.push('Candidate fact missing "rawLabel"')
  if (fact.rawValue === undefined || fact.rawValue === null) errors.push('Candidate fact missing "rawValue"')
  if (typeof fact.confidence !== 'number' || fact.confidence < 0 || fact.confidence > 1) {
    errors.push(`Candidate fact "${fact.rawLabel}" has invalid confidence ${fact.confidence}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export const validateExtractionResult = (result: DocumentExtractionResult): ValidationResult => {
  const errors: string[] = []

  if (!result.documentId) errors.push('Extraction result missing "documentId"')
  if (!result.documentType) errors.push('Extraction result missing "documentType"')
  if (!Array.isArray(result.fields)) {
    errors.push('Extraction result "fields" must be an array')
    return { valid: false, errors }
  }

  for (let i = 0; i < result.fields.length; i++) {
    const factValidation = validateCandidateFact(result.fields[i])
    if (!factValidation.valid) {
      errors.push(...factValidation.errors.map((e) => `Field [${i}]: ${e}`))
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
