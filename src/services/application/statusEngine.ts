import type { ApplicationDefinition, ApplicationRecord, ApplicationStatus, ReadinessResult } from '../../domain/types'
import { getApplicableRequirements } from './requirementsEngine'

const terminalStatuses: ApplicationStatus[] = ['submitted', 'quoted', 'bound', 'declined', 'closed']

export const deriveApplicationStatus = (
  application: ApplicationRecord,
  definition: ApplicationDefinition,
  readiness: ReadinessResult,
): ApplicationStatus => {
  if (terminalStatuses.includes(application.status)) return application.status
  if (readiness.ready) return 'ready_to_submit'
  if (readiness.unresolvedConflicts.length > 0) return 'broker_review'
  if (readiness.missingRequirements.length === 0 && readiness.missingConfirmations.length > 0) return 'customer_review'
  if (readiness.missingBrokerVerifications.length > 0) return 'broker_review'
  if (readiness.missingRequirements.length === 0) return 'customer_review'

  const satisfiedCount = getApplicableRequirements(application, definition).filter((evaluation) => evaluation.satisfied).length
  return satisfiedCount === 0 ? 'draft' : 'collecting_information'
}
