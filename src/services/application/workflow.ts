import { getApplicationDefinition } from '../../domain/applicationDefinitions'
import type { ApplicationRecord, FieldProvenance, FieldValue } from '../../domain/types'
import { evaluateConflicts, getRelevantEvidence, resolveConflict as resolveFieldConflict } from '../conflicts/conflictEngine'
import { valuesEquivalent } from '../conflicts/normalization'
import { getSupportedCanonicalFields, getFieldValue, hasMeaningfulValue, setFieldValue } from './fieldAccess'
import { calculateReadiness } from './readinessEngine'
import {
  buildFieldState,
  computeCompletion,
  evaluateRequirements,
  getFieldLabel,
  getRequirementByField,
  getWizardQuestions,
} from './requirementsEngine'
import { deriveApplicationStatus } from './statusEngine'

const getDefinition = (application: ApplicationRecord) => getApplicationDefinition(application.definitionId, application.definitionVersion)

const cloneFieldProvenance = (provenance: FieldProvenance[]) => provenance.map((item) => ({ ...item }))

const findSelectedEvidence = (application: ApplicationRecord, canonicalField: string, selectedValue: FieldValue | undefined) => {
  if (!hasMeaningfulValue(selectedValue)) return undefined

  const provenance = application.profile.fieldProvenance.filter((item) => item.canonicalField === canonicalField)
  const matching = provenance.find((item) => item.value === selectedValue)
  if (matching) return matching

  return getRelevantEvidence(provenance).find((item) => item.value === selectedValue)
}

export const hydrateFieldStates = (application: ApplicationRecord) => {
  if (application.fieldStates.length > 0) return application

  const updatedAt = new Date().toISOString()
  const fieldStates = getSupportedCanonicalFields().flatMap((canonicalField) => {
    const selectedValue = getFieldValue(application, canonicalField)
    const selectedEvidence = findSelectedEvidence(application, canonicalField, selectedValue)
    if (!hasMeaningfulValue(selectedValue) && !selectedEvidence) return []

    return [buildFieldState(
      canonicalField,
      selectedValue,
      selectedEvidence?.id,
      selectedEvidence?.customerConfirmed ?? false,
      selectedEvidence?.brokerVerified ?? false,
      selectedEvidence?.timestamp ?? updatedAt,
    )]
  })

  return { ...application, fieldStates }
}

export const recalculateApplication = (application: ApplicationRecord) => {
  const hydrated = hydrateFieldStates(application)
  const definition = getDefinition(hydrated)
  const conflicts = evaluateConflicts(hydrated, definition.requirements.filter((requirement) => requirement.material))
  const withConflicts = { ...hydrated, conflicts }
  const completion = computeCompletion(withConflicts, definition)
  const missingFields = evaluateRequirements(withConflicts, definition)
    .filter((evaluation) => evaluation.applicable && evaluation.requirement.required && !evaluation.satisfied)
    .map((evaluation) => evaluation.requirement.canonicalField)
  const readiness = calculateReadiness(withConflicts, definition)
  const status = deriveApplicationStatus(withConflicts, definition, readiness)

  return {
    ...withConflicts,
    completion,
    missingFields,
    customerConfirmed: readiness.missingConfirmations.length === 0,
    brokerVerified: readiness.missingBrokerVerifications.length === 0,
    status,
  }
}

const upsertFieldState = (
  application: ApplicationRecord,
  canonicalField: string,
  value: FieldValue,
  selectedEvidenceId: string,
  customerConfirmed: boolean,
  brokerVerified: boolean,
  updatedAt: string,
) => {
  const existing = application.fieldStates.find((fieldState) => fieldState.canonicalField === canonicalField)
  const nextState = buildFieldState(canonicalField, value, selectedEvidenceId, customerConfirmed, brokerVerified, updatedAt)

  return existing
    ? {
      ...application,
      fieldStates: application.fieldStates.map((fieldState) => fieldState.canonicalField === canonicalField ? nextState : fieldState),
    }
    : { ...application, fieldStates: [...application.fieldStates, nextState] }
}

const appendCustomerProvenance = (
  application: ApplicationRecord,
  canonicalField: string,
  value: FieldValue,
  confirmed: boolean,
) => {
  const definition = getDefinition(application)
  const existing = application.profile.fieldProvenance.find(
    (item) => item.canonicalField === canonicalField && item.sourceType === 'customer_answer' && valuesEquivalent(item.value, value),
  )

  if (existing) {
    const nextProvenance = confirmed && !existing.customerConfirmed
      ? application.profile.fieldProvenance.map((item) => item.id === existing.id ? { ...item, customerConfirmed: true } : item)
      : cloneFieldProvenance(application.profile.fieldProvenance)

    return {
      application: {
        ...application,
        profile: {
          ...application.profile,
          fieldProvenance: nextProvenance,
        },
      },
      provenance: {
        ...existing,
        customerConfirmed: confirmed || existing.customerConfirmed,
      },
    }
  }

  const timestamp = new Date().toISOString()
  const provenance: FieldProvenance = {
    id: `prov-customer-${canonicalField}-${timestamp}`,
    agency_id: application.agency_id,
    application_id: application.id,
    canonicalField,
    label: getFieldLabel(definition, canonicalField),
    value,
    sourceType: 'customer_answer',
    confidence: 1,
    customerConfirmed: confirmed,
    brokerVerified: false,
    timestamp,
  }

  return {
    application: {
      ...application,
      profile: {
        ...application.profile,
        fieldProvenance: [...cloneFieldProvenance(application.profile.fieldProvenance), provenance],
      },
    },
    provenance,
  }
}

export const getDefinitionQuestions = (application: ApplicationRecord) => getWizardQuestions(application, getDefinition(application))

export const answerRequirement = (application: ApplicationRecord, canonicalField: string, value: FieldValue) => {
  const definition = getDefinition(application)
  const requirement = getRequirementByField(definition, canonicalField)
  const confirmed = requirement ? !requirement.requiresCustomerConfirmation : true
  const withValue = setFieldValue(hydrateFieldStates(application), canonicalField, value)
  const { application: withProvenance, provenance } = appendCustomerProvenance(withValue, canonicalField, value, confirmed)
  const withState = upsertFieldState(withProvenance, canonicalField, value, provenance.id, confirmed, false, provenance.timestamp)
  return recalculateApplication(withState)
}

export const confirmCustomerReview = (application: ApplicationRecord) => {
  const hydrated = hydrateFieldStates(application)
  const definition = getDefinition(hydrated)
  const confirmableFields = definition.requirements
    .filter((requirement) => requirement.requiresCustomerConfirmation)
    .map((requirement) => requirement.canonicalField)

  const timestamp = new Date().toISOString()
  const selectedCustomerEvidenceIds = new Set(
    hydrated.fieldStates
      .filter((fieldState) => confirmableFields.includes(fieldState.canonicalField))
      .map((fieldState) => fieldState.selectedEvidenceId)
      .filter((evidenceId): evidenceId is string => Boolean(evidenceId)),
  )
  const next = {
    ...hydrated,
    fieldStates: hydrated.fieldStates.map((fieldState) =>
      confirmableFields.includes(fieldState.canonicalField)
        ? { ...fieldState, customerConfirmed: hasMeaningfulValue(fieldState.selectedValue), updatedAt: timestamp }
        : fieldState,
    ),
    profile: {
      ...hydrated.profile,
      fieldProvenance: hydrated.profile.fieldProvenance.map((item) =>
        selectedCustomerEvidenceIds.has(item.id) && item.sourceType === 'customer_answer'
          ? { ...item, customerConfirmed: true, timestamp }
          : item,
      ),
    },
  }

  return recalculateApplication(next)
}

export const applyCustomerReviewChange = (
  application: ApplicationRecord,
  canonicalField: string,
  value: FieldValue,
) => {
  const withValue = setFieldValue(hydrateFieldStates(application), canonicalField, value)
  const { application: withProvenance, provenance } = appendCustomerProvenance(withValue, canonicalField, value, true)
  const withState = upsertFieldState(withProvenance, canonicalField, value, provenance.id, true, false, provenance.timestamp)
  return recalculateApplication(withState)
}

export const verifyApplication = (application: ApplicationRecord) => {
  const hydrated = hydrateFieldStates(application)
  const definition = getDefinition(hydrated)
  const verifiableFields = definition.requirements
    .filter((requirement) => requirement.requiresBrokerVerification)
    .map((requirement) => requirement.canonicalField)
  const timestamp = new Date().toISOString()

  const currentConflicts = evaluateConflicts(hydrated, definition.requirements.filter((requirement) => requirement.material))
  const conflictedFields = new Set(
    currentConflicts
      .filter((conflict) => conflict.blocking && conflict.status !== 'resolved')
      .map((conflict) => conflict.canonicalField),
  )
  const next = {
    ...hydrated,
    fieldStates: hydrated.fieldStates.map((fieldState) =>
      verifiableFields.includes(fieldState.canonicalField)
        && hasMeaningfulValue(fieldState.selectedValue)
        && !conflictedFields.has(fieldState.canonicalField)
        ? { ...fieldState, brokerVerified: true, updatedAt: timestamp }
        : fieldState,
    ),
    brokerNotes: [...hydrated.brokerNotes, 'Broker verified all required fields for submission readiness.'],
  }

  return recalculateApplication(next)
}

export const resolveApplicationConflict = (
  application: ApplicationRecord,
  conflictId: string,
  action: 'accept_customer' | 'use_evidence' | 'request_clarification' | 'correct_value',
  correctedValue?: FieldValue,
) => recalculateApplication(resolveFieldConflict(hydrateFieldStates(application), conflictId, action, correctedValue))

export const processDocumentIntake = (application: ApplicationRecord) => {
  const timestamp = new Date().toISOString()
  const next = {
    ...hydrateFieldStates(application),
    profile: {
      ...application.profile,
      preferredChannel: 'document_upload' as const,
      documents: application.profile.documents.map((document) =>
        document.type === 'Current Policy' ? { ...document, status: 'complete' as const } : document,
      ),
      fieldProvenance: application.profile.fieldProvenance.map((item) =>
        item.sourceDocument === 'CurrentPolicy.pdf' ? { ...item, customerConfirmed: false, timestamp } : item,
      ),
    },
  }

  return recalculateApplication(next)
}

export const markGenerated = (application: ApplicationRecord) => recalculateApplication({
  ...hydrateFieldStates(application),
  generatedAt: new Date().toISOString(),
})
