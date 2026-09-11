import { getApplicationDefinition } from '../domain/applicationDefinitions'
import type { ApplicationRecord, FieldValue } from '../domain/types'
import { computeCompletion as deriveCompletion, getFieldLabel as lookupFieldLabel, getWizardQuestions as deriveWizardQuestions } from './application/requirementsEngine'
import { answerRequirement, recalculateApplication } from './application/workflow'

const getDefinition = (application: ApplicationRecord) => getApplicationDefinition(application.definitionId, application.definitionVersion)

export const getFieldLabel = (field: string, application?: ApplicationRecord) => {
  if (application) return lookupFieldLabel(getDefinition(application), field)
  return field
}

export const computeMissingFields = (application: ApplicationRecord) =>
  recalculateApplication(application).missingFields

export const computeCompletion = (application: ApplicationRecord) =>
  deriveCompletion(recalculateApplication(application), getDefinition(application))

export const getWizardQuestions = (application: ApplicationRecord) =>
  deriveWizardQuestions(recalculateApplication(application), getDefinition(application))

export const applyWizardAnswer = (
  application: ApplicationRecord,
  field: string,
  value: FieldValue,
) => answerRequirement(application, field, value)
