import type { ApplicationRecord, FieldValue } from '../domain/types'
import { applyCustomerReviewChange as applyCustomerFieldChange, resolveApplicationConflict } from './application/workflow'

export const applyCustomerReviewChange = (
  application: ApplicationRecord,
  field: string,
  value: FieldValue,
) => applyCustomerFieldChange(application, field, value)

export const resolveConflict = (
  application: ApplicationRecord,
  conflictId: string,
  action: 'accept_customer' | 'use_evidence' | 'request_clarification' | 'correct_value',
  correctedValue?: FieldValue,
) => resolveApplicationConflict(application, conflictId, action, correctedValue)
