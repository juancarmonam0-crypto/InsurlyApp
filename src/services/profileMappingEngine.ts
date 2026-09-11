import { getApplicationDefinition } from '../domain/applicationDefinitions'
import { findCanonicalDefinition, normalizeCanonicalKey } from '../domain/canonicalRegistry'
import type {
  ApplicationDefinition,
  ApplicationRecord,
  CustomerRecord,
  FieldProvenance,
  FieldValue,
  ProfileFactMetadata,
  RequirementDefinition,
} from '../domain/types'
import { getFieldValue, hasMeaningfulValue, setFieldValue } from './application/fieldAccess'
import { buildFieldState } from './application/requirementsEngine'
import { recalculateApplication } from './application/workflow'
import { extractFactsFromCustomerProfile } from './customerProfileService'

export interface RequirementMappingStatus {
  requirement: RequirementDefinition
  canonicalKey: string
  canonicalLabel: string
  matchedFact?: ProfileFactMetadata
  currentApplicationValue?: FieldValue
  canPrefill: boolean
  isConfirmed: boolean
  isVerified: boolean
  hasConflict: boolean
  status: 'satisfied' | 'prefillable' | 'missing' | 'protected_confirmed' | 'protected_verified' | 'conflicted'
}

export const findProfileFactForRequirement = (
  customer: CustomerRecord,
  canonicalField: string,
): ProfileFactMetadata | undefined => {
  const normKey = normalizeCanonicalKey(canonicalField)
  const def = findCanonicalDefinition(canonicalField)
  const aliases = def?.aliases ?? []
  const candidates = [normKey, canonicalField, ...aliases]

  const facts = extractFactsFromCustomerProfile(customer)
  return facts.find((fact) => candidates.includes(fact.fieldKey))
}

export const analyzeRequirementMapping = (
  application: ApplicationRecord,
  customer: CustomerRecord,
  requirement: RequirementDefinition,
): RequirementMappingStatus => {
  const normKey = normalizeCanonicalKey(requirement.canonicalField)
  const def = findCanonicalDefinition(requirement.canonicalField)
  const canonicalLabel = def?.label ?? requirement.label

  const matchedFact = findProfileFactForRequirement(customer, requirement.canonicalField)
  const currentVal = getFieldValue(application, requirement.canonicalField)
  const fieldState = application.fieldStates.find(
    (fs) => fs.canonicalField === requirement.canonicalField || fs.canonicalField === normKey,
  )

  const isConfirmed = fieldState?.customerConfirmed ?? false
  const isVerified = fieldState?.brokerVerified ?? false
  const hasConflict = application.conflicts.some(
    (c) => (c.canonicalField === requirement.canonicalField || c.canonicalField === normKey) && c.status !== 'resolved',
  )
  const hasEvidence = Boolean(fieldState?.selectedEvidenceId)
  const hasCurrentVal = hasMeaningfulValue(currentVal)

  const isProtected = isConfirmed || isVerified || hasConflict || (hasEvidence && hasCurrentVal)
  const canPrefill = Boolean(matchedFact && !isProtected)

  let status: RequirementMappingStatus['status'] = 'missing'
  if (hasConflict) {
    status = 'conflicted'
  } else if (isVerified) {
    status = 'protected_verified'
  } else if (isConfirmed) {
    status = 'protected_confirmed'
  } else if (hasCurrentVal) {
    status = 'satisfied'
  } else if (canPrefill) {
    status = 'prefillable'
  }

  return {
    requirement,
    canonicalKey: normKey,
    canonicalLabel,
    matchedFact,
    currentApplicationValue: currentVal,
    canPrefill,
    isConfirmed,
    isVerified,
    hasConflict,
    status,
  }
}

export const prefillApplicationFromProfile = (
  application: ApplicationRecord,
  customer: CustomerRecord,
): ApplicationRecord => {
  const definition = getApplicationDefinition(application.definitionId, application.definitionVersion)
  const timestamp = new Date().toISOString()

  let workingApp = { ...application }
  const nextFieldStates = [...workingApp.fieldStates]
  const nextProvenance: FieldProvenance[] = [...workingApp.profile.fieldProvenance]

  definition.requirements.forEach((requirement) => {
    const analysis = analyzeRequirementMapping(workingApp, customer, requirement)
    if (!analysis.canPrefill || !analysis.matchedFact) return

    const fact = analysis.matchedFact
    const reqKey = requirement.canonicalField

    // Set value in application profile model
    workingApp = setFieldValue(workingApp, reqKey, fact.value)

    // Update field state
    const existingStateIndex = nextFieldStates.findIndex((fs) => fs.canonicalField === reqKey)
    const newState = buildFieldState(
      reqKey,
      fact.value,
      fact.id,
      fact.customerConfirmed,
      fact.brokerVerified,
      timestamp,
    )
    newState.selectedEvidenceId = 'existing_profile'

    if (existingStateIndex >= 0) {
      nextFieldStates[existingStateIndex] = newState
    } else {
      nextFieldStates.push(newState)
    }

    // Add provenance entry
    const provenanceEntry: FieldProvenance = {
      id: `prov-profile-${reqKey}-${timestamp}`,
      agency_id: workingApp.agency_id,
      application_id: workingApp.id,
      canonicalField: reqKey,
      label: analysis.canonicalLabel,
      value: fact.value,
      sourceType: 'existing_profile',
      confidence: fact.confidence ?? 1.0,
      customerConfirmed: fact.customerConfirmed,
      brokerVerified: fact.brokerVerified,
      timestamp,
      metadata: {
        profileFactId: fact.id,
        entityType: fact.entityType,
        sourceType: fact.sourceType,
      },
    }

    nextProvenance.push(provenanceEntry)
  })

  workingApp.fieldStates = nextFieldStates
  workingApp.profile = {
    ...workingApp.profile,
    fieldProvenance: nextProvenance,
  }

  return recalculateApplication(workingApp)
}

export const createNewApplicationFromProfile = (
  customer: CustomerRecord,
  definitionId: string,
  version: number,
  agencyId: string,
  applicationId?: string,
): ApplicationRecord => {
  const definition = getApplicationDefinition(definitionId, version)
  const appId = applicationId ?? `app-${customer.id}-${Date.now()}`
  const now = new Date().toISOString()

  const rawApplication: ApplicationRecord = {
    id: appId,
    agency_id: agencyId,
    customerId: customer.id,
    customerName: customer.displayName,
    definitionId,
    definitionVersion: version,
    lineOfBusiness: definition.lineOfBusiness,
    status: 'draft',
    completion: 0,
    profile: {
      agency_id: agencyId,
      customer_id: customer.id,
      application_id: appId,
      preferredChannel: customer.profile.preferredChannel ?? 'smart_wizard',
      business: structuredClone(customer.profile.business),
      people: structuredClone(customer.profile.people),
      locations: structuredClone(customer.profile.locations),
      vehicles: structuredClone(customer.profile.vehicles),
      currentInsurance: structuredClone(customer.profile.currentInsurance),
      lossHistory: structuredClone(customer.profile.lossHistory),
      documents: structuredClone(customer.profile.documents),
      fieldProvenance: [],
    },
    fieldStates: [],
    missingFields: [],
    conflicts: [], // Do NOT copy historical conflicts!
    customerConfirmed: false,
    brokerVerified: false,
    brokerNotes: [],
    createdAt: now,
    updatedAt: now,
  }

  return prefillApplicationFromProfile(rawApplication, customer)
}

export const evaluateProfileCoverage = (customer: CustomerRecord, definition: ApplicationDefinition) => {
  const totalRequirements = definition.requirements.length
  let prefillableCount = 0
  let missingCount = 0

  const items = definition.requirements.map((req) => {
    const fact = findProfileFactForRequirement(customer, req.canonicalField)
    if (fact) {
      prefillableCount++
      return { requirement: req, fact, status: 'covered' as const }
    }
    missingCount++
    return { requirement: req, fact: undefined, status: 'missing' as const }
  })

  return {
    totalRequirements,
    prefillableCount,
    missingCount,
    coveragePercent: totalRequirements > 0 ? Math.round((prefillableCount / totalRequirements) * 100) : 0,
    items,
  }
}
