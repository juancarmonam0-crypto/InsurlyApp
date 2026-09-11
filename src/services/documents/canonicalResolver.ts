import type { ApplicationRecord, CandidateFactStatus, ExtractedCandidateFact } from '../../domain/types'
import { findCanonicalDefinition, normalizeCanonicalValue } from '../../domain/canonicalRegistry'

export const resolveCanonicalMapping = (
  fact: ExtractedCandidateFact,
  application: ApplicationRecord,
): ExtractedCandidateFact => {
  const proposedKey = fact.proposedCanonicalField || fact.canonicalField
  const def = findCanonicalDefinition(proposedKey)

  if (!def) {
    return {
      ...fact,
      canonicalField: proposedKey,
      status: 'unmapped',
      warnings: [...(fact.warnings || []), `Unknown canonical field or alias "${proposedKey}"`],
    }
  }

  const canonicalKey = def.key
  const normalizedValue = normalizeCanonicalValue(canonicalKey, fact.rawValue)

  // Type verification
  let isTypeValid = true
  if (def.valueType === 'number' || def.valueType === 'currency') {
    if (typeof normalizedValue !== 'number' || isNaN(normalizedValue)) {
      isTypeValid = false
    }
  } else if (def.valueType === 'boolean') {
    if (typeof normalizedValue !== 'boolean') {
      isTypeValid = false
    }
  }

  if (!isTypeValid) {
    return {
      ...fact,
      canonicalField: canonicalKey,
      entityType: def.entityType,
      normalizedValue,
      status: 'invalid',
      warnings: [...(fact.warnings || []), `Value "${String(fact.rawValue)}" does not match expected type ${def.valueType}`],
    }
  }

  // Phase 9: Repeating Entity Resolution
  let resolvedEntityId = fact.entityId
  let entityStatus: CandidateFactStatus = fact.status === 'valid' ? 'valid' : fact.status

  if (def.entityType === 'vehicle') {
    const existingVehicles = application.profile.vehicles || []
    if (fact.entityId && existingVehicles.some((v) => v.id === fact.entityId)) {
      resolvedEntityId = fact.entityId
    } else if (existingVehicles.length === 1) {
      resolvedEntityId = existingVehicles[0].id
    } else if (existingVehicles.length > 1) {
      entityStatus = 'entity_resolution_required'
    }
  } else if (def.entityType === 'person') {
    const existingPeople = application.profile.people || []
    if (fact.entityId && existingPeople.some((p) => p.id === fact.entityId)) {
      resolvedEntityId = fact.entityId
    } else if (existingPeople.length === 1) {
      resolvedEntityId = existingPeople[0].id
    } else if (existingPeople.length > 1) {
      entityStatus = 'entity_resolution_required'
    }
  } else if (def.entityType === 'location') {
    const existingLocations = application.profile.locations || []
    if (fact.entityId && existingLocations.some((l) => l.id === fact.entityId)) {
      resolvedEntityId = fact.entityId
    } else if (existingLocations.length === 1) {
      resolvedEntityId = existingLocations[0].id
    } else if (existingLocations.length > 1) {
      entityStatus = 'entity_resolution_required'
    }
  }

  return {
    ...fact,
    canonicalField: canonicalKey,
    entityType: def.entityType,
    entityId: resolvedEntityId,
    normalizedValue,
    status: entityStatus,
  }
}
