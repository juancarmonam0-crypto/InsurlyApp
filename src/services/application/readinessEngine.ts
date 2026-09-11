import type { ApplicationDefinition, ApplicationRecord, ReadinessResult } from '../../domain/types'
import {
  getMissingRequirements,
  getRequirementsNeedingBrokerVerification,
  getRequirementsNeedingCustomerConfirmation,
} from './requirementsEngine'

export const calculateReadiness = (
  application: ApplicationRecord,
  definition: ApplicationDefinition,
): ReadinessResult => {
  const missingRequirements = getMissingRequirements(application, definition)
  const missingConfirmations = getRequirementsNeedingCustomerConfirmation(application, definition)
  const missingBrokerVerifications = getRequirementsNeedingBrokerVerification(application, definition)
  const unresolvedConflicts = application.conflicts.filter((conflict) => conflict.blocking && conflict.status !== 'resolved')

  const blockers = [
    ...missingRequirements.map((evaluation) => ({
      type: 'missing_requirement' as const,
      canonicalField: evaluation.requirement.canonicalField,
      message: `${evaluation.requirement.label} is still required.`,
    })),
    ...missingConfirmations.map((evaluation) => ({
      type: 'customer_confirmation' as const,
      canonicalField: evaluation.requirement.canonicalField,
      message: `${evaluation.requirement.label} still needs customer confirmation.`,
    })),
    ...missingBrokerVerifications.map((evaluation) => ({
      type: 'broker_verification' as const,
      canonicalField: evaluation.requirement.canonicalField,
      message: `${evaluation.requirement.label} still needs broker verification.`,
    })),
    ...unresolvedConflicts.map((conflict) => ({
      type: 'conflict' as const,
      canonicalField: conflict.canonicalField,
      message: conflict.message,
    })),
  ]

  return {
    ready: blockers.length === 0,
    blockers,
    missingRequirements,
    unresolvedConflicts,
    missingConfirmations,
    missingBrokerVerifications,
  }
}
