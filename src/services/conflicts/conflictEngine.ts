import type {
  ApplicationFieldState,
  ApplicationRecord,
  ConflictRecord,
  ConflictResolutionType,
  FieldProvenance,
  FieldValue,
  RequirementDefinition,
} from '../../domain/types'
import { getFieldValue, hasMeaningfulValue, setFieldValue } from '../application/fieldAccess'
import { valuesEquivalent } from './normalization'

const isHistoricalDocument = (evidence: FieldProvenance) => {
  const label = `${evidence.sourceDocument ?? ''} ${evidence.label}`.toLowerCase()
  return /previous|prior|historical/.test(label)
}

const isCurrentDocument = (evidence: FieldProvenance) => {
  const label = `${evidence.sourceDocument ?? ''} ${evidence.label}`.toLowerCase()
  return /current|renewal|active/.test(label)
}

export const getRelevantEvidence = (provenance: FieldProvenance[]) => {
  const nonCustomerEvidence = provenance.filter((item) => item.sourceType !== 'customer_answer')
  const currentEvidence = nonCustomerEvidence.filter(isCurrentDocument)
  if (currentEvidence.length > 0) return currentEvidence

  const activeEvidence = nonCustomerEvidence.filter((item) => !isHistoricalDocument(item))
  if (activeEvidence.length > 0) return activeEvidence

  return nonCustomerEvidence
}

const getLatestCustomerDeclaration = (provenance: FieldProvenance[]) => provenance
  .filter((item) => item.sourceType === 'customer_answer')
  .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0]

const getRequirementMap = (requirements: RequirementDefinition[]) => new Map(requirements.map((requirement) => [requirement.canonicalField, requirement]))

const isSameConflictShape = (existing: ConflictRecord, next: ConflictRecord) => {
  if (!valuesEquivalent(existing.customerValue, next.customerValue)) return false
  if (existing.evidence.length != next.evidence.length) return false

  return existing.evidence.every((evidence, index) => {
    const candidate = next.evidence[index]
    return candidate !== undefined
      && evidence.id === candidate.id
      && valuesEquivalent(evidence.value, candidate.value)
  })
}

const getFieldState = (application: ApplicationRecord, canonicalField: string): ApplicationFieldState | undefined =>
  application.fieldStates.find((fieldState) => fieldState.canonicalField === canonicalField)

export const evaluateConflict = (
  application: ApplicationRecord,
  requirement: RequirementDefinition,
): ConflictRecord | null => {
  const provenance = application.profile.fieldProvenance.filter((item) => item.canonicalField === requirement.canonicalField)
  const customerDeclaration = getLatestCustomerDeclaration(provenance)
  const currentSelectedVal = getFieldValue(application, requirement.canonicalField)
  const declaredVal = customerDeclaration?.value ?? currentSelectedVal

  if (!hasMeaningfulValue(declaredVal)) return null

  const evidence = getRelevantEvidence(provenance)
  if (evidence.length === 0) return null

  const conflictsEvidence = evidence.filter((item) => !valuesEquivalent(item.value, declaredVal))
  if (conflictsEvidence.length === 0) return null

  const existing = application.conflicts.find((conflict) => conflict.canonicalField === requirement.canonicalField)
  const timestamp = new Date().toISOString()

  const nextConflict: ConflictRecord = {
    id: existing?.id ?? `conflict-${requirement.id}`,
    agency_id: application.agency_id,
    application_id: application.id,
    canonicalField: requirement.canonicalField,
    label: requirement.label,
    status: 'open',
    message: 'Conflicting information detected. Broker review recommended.',
    customerValue: declaredVal,
    evidence: conflictsEvidence,
    material: requirement.material,
    blocking: requirement.material,
    updatedAt: timestamp,
    resolution: existing?.resolution,
  }

  if (existing?.status && existing.status !== 'open' && isSameConflictShape(existing, nextConflict)) {
    return { ...nextConflict, status: existing.status }
  }

  return nextConflict
}

export const evaluateConflicts = (application: ApplicationRecord, requirements: RequirementDefinition[]) => {
  const requirementMap = getRequirementMap(requirements)
  const evaluated = requirements
    .map((requirement) => evaluateConflict(application, requirement))
    .filter((conflict): conflict is ConflictRecord => conflict !== null)

  const retainedResolvedOrOpenDoc = application.conflicts.filter((conflict) => {
    if (conflict.status === 'resolved' || conflict.status === 'open') {
      return requirementMap.has(conflict.canonicalField)
    }
    return false
  })

  const merged = new Map<string, ConflictRecord>()
  ;[...retainedResolvedOrOpenDoc, ...evaluated].forEach((conflict) => {
    merged.set(conflict.canonicalField, conflict)
  })

  return [...merged.values()].sort((left, right) => left.label.localeCompare(right.label))
}

const updateFieldState = (
  application: ApplicationRecord,
  canonicalField: string,
  updates: Partial<ApplicationFieldState>,
) => ({
  ...application,
  fieldStates: application.fieldStates.map((fieldState) =>
    fieldState.canonicalField === canonicalField ? { ...fieldState, ...updates } : fieldState,
  ),
})

const appendBrokerEvidence = (
  application: ApplicationRecord,
  canonicalField: string,
  value: FieldValue,
  label: string,
) => {
  const timestamp = new Date().toISOString()
  const provenance: FieldProvenance = {
    id: `prov-broker-${canonicalField}-${timestamp}`,
    agency_id: application.agency_id,
    application_id: application.id,
    canonicalField,
    label,
    value,
    sourceType: 'broker',
    confidence: 1,
    customerConfirmed: false,
    brokerVerified: true,
    timestamp,
  }

  return {
    ...application,
    profile: {
      ...application.profile,
      fieldProvenance: [...application.profile.fieldProvenance, provenance],
    },
  }
}

export const resolveConflict = (
  application: ApplicationRecord,
  conflictId: string,
  action: ConflictResolutionType,
  correctedValue?: FieldValue,
) => {
  const conflict = application.conflicts.find((candidate) => candidate.id === conflictId)
  if (!conflict) return application

  const timestamp = new Date().toISOString()
  const currentFieldState = getFieldState(application, conflict.canonicalField)
  let next = application
  let resolutionValue = currentFieldState?.selectedValue
  let selectedEvidenceId = currentFieldState?.selectedEvidenceId
  let note = ''
  let status: ConflictRecord['status'] = 'resolved'

  if (action === 'accept_customer') {
    const customerDeclaration = application.profile.fieldProvenance
      .filter((item) => item.canonicalField === conflict.canonicalField && item.sourceType === 'customer_answer')
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0]
    if (!customerDeclaration) return application
    resolutionValue = customerDeclaration.value
    selectedEvidenceId = customerDeclaration.id
    next = setFieldValue(next, conflict.canonicalField, customerDeclaration.value)
    note = `Broker accepted the customer-provided ${conflict.label.toLowerCase()}.`
  }

  if (action === 'use_evidence') {
    const evidence = conflict.evidence[0]
    if (!evidence) return application
    resolutionValue = evidence.value
    selectedEvidenceId = evidence.id
    next = setFieldValue(next, conflict.canonicalField, evidence.value)
    note = `Broker selected document evidence for ${conflict.label.toLowerCase()}.`
  }

  if (action === 'correct_value') {
    if (!hasMeaningfulValue(correctedValue)) return application
    resolutionValue = correctedValue
    next = appendBrokerEvidence(next, conflict.canonicalField, correctedValue as FieldValue, conflict.label)
    selectedEvidenceId = next.profile.fieldProvenance.at(-1)?.id
    next = setFieldValue(next, conflict.canonicalField, correctedValue as FieldValue)
    note = `Broker corrected ${conflict.label.toLowerCase()} to a verified value.`
  }

  if (action === 'request_clarification') {
    status = 'clarification_requested'
    note = `Broker requested clarification for ${conflict.label.toLowerCase()}.`
  }

  next = updateFieldState(next, conflict.canonicalField, {
    selectedValue: resolutionValue,
    selectedEvidenceId,
    brokerVerified: status === 'resolved',
    updatedAt: timestamp,
  })

  return {
    ...next,
    conflicts: next.conflicts.map((candidate) =>
      candidate.id === conflictId
        ? {
          ...candidate,
          status,
          updatedAt: timestamp,
          resolution: {
            type: action,
            correctedValue: action === 'correct_value' ? correctedValue : undefined,
            note,
            resolvedAt: timestamp,
          },
        }
        : candidate,
    ),
    brokerNotes: [...next.brokerNotes, note],
  }
}
