import type {
  ApplicationDefinition,
  ApplicationFieldState,
  ApplicationRecord,
  FieldValue,
  RequirementDefinition,
  RequirementEvaluation,
  WizardQuestion,
} from '../../domain/types'
import { getFieldValue, hasMeaningfulValue } from './fieldAccess'

const getFieldState = (application: ApplicationRecord, canonicalField: string): ApplicationFieldState | undefined =>
  application.fieldStates.find((fieldState) => fieldState.canonicalField === canonicalField)

const isApplicable = (application: ApplicationRecord, requirement: RequirementDefinition) => {
  if (!requirement.applicability) return true
  const currentValue = getFieldValue(application, requirement.applicability.field)
  return currentValue === requirement.applicability.equals
}

export const evaluateRequirement = (
  application: ApplicationRecord,
  requirement: RequirementDefinition,
): RequirementEvaluation => {
  const applicable = isApplicable(application, requirement)
  const fieldState = getFieldState(application, requirement.canonicalField)
  const selectedValue = fieldState?.selectedValue ?? getFieldValue(application, requirement.canonicalField)
  const satisfied = applicable ? hasMeaningfulValue(selectedValue) : true

  return {
    requirement,
    applicable,
    satisfied,
    value: selectedValue,
    customerConfirmationPending: applicable
      && satisfied
      && requirement.requiresCustomerConfirmation
      && !fieldState?.customerConfirmed,
    brokerVerificationPending: applicable
      && satisfied
      && requirement.requiresBrokerVerification
      && !fieldState?.brokerVerified,
  }
}

export const evaluateRequirements = (application: ApplicationRecord, definition: ApplicationDefinition) =>
  definition.requirements.map((requirement) => evaluateRequirement(application, requirement))

export const getApplicableRequirements = (application: ApplicationRecord, definition: ApplicationDefinition) =>
  evaluateRequirements(application, definition).filter((evaluation) => evaluation.applicable)

export const getMissingRequirements = (application: ApplicationRecord, definition: ApplicationDefinition) =>
  getApplicableRequirements(application, definition).filter((evaluation) => evaluation.requirement.required && !evaluation.satisfied)

export const getSatisfiedRequirements = (application: ApplicationRecord, definition: ApplicationDefinition) =>
  getApplicableRequirements(application, definition).filter((evaluation) => evaluation.satisfied)

export const getRequirementsNeedingCustomerConfirmation = (application: ApplicationRecord, definition: ApplicationDefinition) =>
  getApplicableRequirements(application, definition).filter((evaluation) => evaluation.customerConfirmationPending)

export const getRequirementsNeedingBrokerVerification = (application: ApplicationRecord, definition: ApplicationDefinition) =>
  getApplicableRequirements(application, definition).filter((evaluation) => evaluation.brokerVerificationPending)

export const getWizardQuestions = (application: ApplicationRecord, definition: ApplicationDefinition): WizardQuestion[] =>
  getApplicableRequirements(application, definition)
    .filter((evaluation) => evaluation.requirement.required && !evaluation.satisfied)
    .map((evaluation) => ({
      id: evaluation.requirement.id,
      canonicalField: evaluation.requirement.canonicalField,
      label: evaluation.requirement.label,
      helperText: `Insurly still needs ${evaluation.requirement.label.toLowerCase()} for the application.`,
      section: evaluation.requirement.section,
      type: evaluation.requirement.inputType,
      required: evaluation.requirement.required,
    }))

export const computeCompletion = (application: ApplicationRecord, definition: ApplicationDefinition) => {
  const requiredApplicable = getApplicableRequirements(application, definition).filter((evaluation) => evaluation.requirement.required)
  if (requiredApplicable.length === 0) return 0

  const satisfiedCount = requiredApplicable.filter((evaluation) => evaluation.satisfied).length
  return Math.round((satisfiedCount / requiredApplicable.length) * 100)
}

export const getFieldLabel = (definition: ApplicationDefinition, canonicalField: string) =>
  definition.requirements.find((requirement) => requirement.canonicalField === canonicalField)?.label ?? canonicalField

export const getRequirementByField = (definition: ApplicationDefinition, canonicalField: string) =>
  definition.requirements.find((requirement) => requirement.canonicalField === canonicalField)

export const buildFieldState = (
  canonicalField: string,
  value: FieldValue | undefined,
  selectedEvidenceId: string | undefined,
  customerConfirmed: boolean,
  brokerVerified: boolean,
  updatedAt: string,
) => ({
  canonicalField,
  selectedValue: value,
  selectedEvidenceId,
  customerConfirmed,
  brokerVerified,
  updatedAt,
})
