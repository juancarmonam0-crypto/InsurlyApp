import type {
  CustomerRecord,
  FieldValue,
  ProfileEntityKind,
  ProfileFactMetadata,
} from '../domain/types'
import {
  CANONICAL_FIELD_REGISTRY,
  findCanonicalDefinition,
  normalizeCanonicalKey,
  normalizeCanonicalValue,
} from '../domain/canonicalRegistry'

export const normalizeProfileField = (fieldKey: string, value: FieldValue): FieldValue =>
  normalizeCanonicalValue(fieldKey, value)

export const extractFactsFromCustomerProfile = (customer: CustomerRecord): ProfileFactMetadata[] => {
  const timestamp = customer.updatedAt || new Date().toISOString()
  const facts: ProfileFactMetadata[] = []

  const addFact = (
    entityType: ProfileEntityKind,
    entityId: string | undefined,
    rawKey: string,
    value: FieldValue | undefined,
    confirmed = false,
    verified = false,
  ) => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return

    const key = normalizeCanonicalKey(rawKey)
    const normValue = normalizeCanonicalValue(key, value)
    const def = findCanonicalDefinition(key)
    const label = def?.label ?? key

    facts.push({
      id: `fact-${customer.id}-${entityType}-${entityId ? `${entityId}-` : ''}${key}`,
      agency_id: customer.agency_id,
      customer_id: customer.id,
      entityType,
      entityId: entityId ?? '',
      fieldKey: key,
      value: normValue,
      sourceType: 'existing_profile',
      confidence: 1.0,
      customerConfirmed: confirmed,
      brokerVerified: verified,
      updatedAt: timestamp,
      metadata: { label },
    })
  }

  // Customer facts
  addFact('customer', undefined, 'customer.displayName', customer.displayName, true, true)
  addFact('customer', undefined, 'customer.email', customer.email, true, true)
  addFact('customer', undefined, 'customer.phone', customer.phone, true, true)

  // Business facts
  if (customer.profile.business) {
    const b = customer.profile.business
    addFact('business', undefined, 'business.legalName', b.legalName, true, true)
    addFact('business', undefined, 'business.dba', b.dba, true, true)
    addFact('business', undefined, 'business.entityType', b.entityType, true, true)
    addFact('business', undefined, 'business.stateOfFormation', b.stateOfFormation, true, true)
    addFact('business', undefined, 'business.annualRevenue', b.annualRevenue, true, true)
    addFact('business', undefined, 'business.naicsCode', b.naicsCode, true, true)
    addFact('business', undefined, 'business.employeeCount', b.employeeCount, true, true)
    addFact('business', undefined, 'business.yearsInBusiness', b.yearsInBusiness, true, true)
    addFact('business', undefined, 'business.fein', b.fein, true, true)
    addFact('business', undefined, 'business.description', b.description, true, true)
  }

  // People facts
  if (customer.profile.people) {
    customer.profile.people.forEach((person) => {
      const parts = person.fullName ? person.fullName.trim().split(/\s+/) : []
      const firstName = parts[0] ?? ''
      const lastName = parts.slice(1).join(' ')

      addFact('person', person.id, 'person.firstName', firstName, true, true)
      addFact('person', person.id, 'person.lastName', lastName, true, true)
      addFact('person', person.id, 'person.role', person.role, true, true)
      addFact('person', person.id, 'person.email', person.email, true, true)
      addFact('person', person.id, 'person.phone', person.phone, true, true)
    })
  }

  // Location facts
  if (customer.profile.locations) {
    customer.profile.locations.forEach((loc) => {
      addFact('location', loc.id, 'location.addressLine1', loc.addressLine1, true, true)
      addFact('location', loc.id, 'location.city', loc.city, true, true)
      addFact('location', loc.id, 'location.state', loc.state, true, true)
      addFact('location', loc.id, 'location.postalCode', loc.postalCode, true, true)
      addFact('location', loc.id, 'location.occupancy', loc.occupancy, true, true)
    })
  }

  // Vehicle facts
  if (customer.profile.vehicles) {
    customer.profile.vehicles.forEach((veh) => {
      addFact('vehicle', veh.id, 'vehicle.year', veh.year, true, true)
      addFact('vehicle', veh.id, 'vehicle.make', veh.make, true, true)
      addFact('vehicle', veh.id, 'vehicle.model', veh.model, true, true)
      addFact('vehicle', veh.id, 'vehicle.vin', veh.vin, true, true)
      addFact('vehicle', veh.id, 'vehicle.usage', veh.usage, true, true)
    })
  }

  // Current Insurance facts
  if (customer.profile.currentInsurance) {
    const pol = customer.profile.currentInsurance
    addFact('policy', undefined, 'currentInsurance.carrierName', pol.carrierName, true, true)
    addFact('policy', undefined, 'currentInsurance.effectiveDate', pol.effectiveDate, true, true)
    addFact('policy', undefined, 'currentInsurance.expirationDate', pol.expirationDate, true, true)
    addFact('policy', undefined, 'currentInsurance.limits', pol.limits, true, true)
    addFact('policy', undefined, 'currentInsurance.premium', pol.premium, true, true)
  }

  // Loss History facts
  if (customer.profile.lossHistory) {
    customer.profile.lossHistory.forEach((loss) => {
      addFact('loss', loss.id, 'loss.date', loss.date, true, true)
      addFact('loss', loss.id, 'loss.description', loss.description, true, true)
      addFact('loss', loss.id, 'loss.amount', loss.amount, true, true)
      addFact('loss', loss.id, 'loss.status', loss.status, true, true)
    })
  }

  // Custom facts
  if (customer.profile.facts) {
    customer.profile.facts.forEach((customFact) => {
      const canonicalKey = normalizeCanonicalKey(customFact.fieldKey)
      const existingIdx = facts.findIndex(
        (f) => f.entityType === customFact.entityType && (f.entityId ?? '') === (customFact.entityId ?? '') && f.fieldKey === canonicalKey,
      )

      if (existingIdx >= 0) {
        facts[existingIdx] = { ...customFact, fieldKey: canonicalKey }
      } else {
        facts.push({ ...customFact, fieldKey: canonicalKey })
      }
    })
  }

  return facts
}

export const getAvailableCanonicalFacts = (customer: CustomerRecord): ProfileFactMetadata[] =>
  extractFactsFromCustomerProfile(customer)

export const getProfileField = (
  customer: CustomerRecord,
  entityType: ProfileEntityKind,
  rawFieldKey: string,
  entityId = '',
): FieldValue | undefined => {
  const canonicalKey = normalizeCanonicalKey(rawFieldKey)
  const facts = getAvailableCanonicalFacts(customer)
  const match = facts.find(
    (f) => f.entityType === entityType && (f.entityId ?? '') === entityId && f.fieldKey === canonicalKey,
  )

  return match?.value
}

export const setProfileFact = (customer: CustomerRecord, fact: ProfileFactMetadata): CustomerRecord => {
  const canonicalKey = normalizeCanonicalKey(fact.fieldKey)
  const normValue = normalizeCanonicalValue(canonicalKey, fact.value)
  const normFact: ProfileFactMetadata = {
    ...fact,
    fieldKey: canonicalKey,
    value: normValue,
    updatedAt: fact.updatedAt || new Date().toISOString(),
  }

  const existingFacts = customer.profile.facts ?? []
  const existingIndex = existingFacts.findIndex(
    (f) => f.entityType === normFact.entityType && (f.entityId ?? '') === (normFact.entityId ?? '') && f.fieldKey === canonicalKey,
  )

  const updatedFacts = existingIndex >= 0
    ? existingFacts.map((f, i) => (i === existingIndex ? normFact : f))
    : [...existingFacts, normFact]

  // Update inline profile properties where appropriate
  const nextProfile = { ...customer.profile, facts: updatedFacts }

  if (normFact.entityType === 'business' && nextProfile.business) {
    if (canonicalKey === 'business.legalName' && typeof normValue === 'string') {
      nextProfile.business = { ...nextProfile.business, legalName: normValue }
    } else if (canonicalKey === 'business.annualRevenue' && typeof normValue === 'number') {
      nextProfile.business = { ...nextProfile.business, annualRevenue: normValue }
    } else if (canonicalKey === 'business.fein' && typeof normValue === 'string') {
      nextProfile.business = { ...nextProfile.business, fein: normValue }
    } else if (canonicalKey === 'business.employeeCount' && typeof normValue === 'number') {
      nextProfile.business = { ...nextProfile.business, employeeCount: normValue }
    } else if (canonicalKey === 'business.naicsCode' && typeof normValue === 'string') {
      nextProfile.business = { ...nextProfile.business, naicsCode: normValue }
    }
  }

  return {
    ...customer,
    updatedAt: normFact.updatedAt,
    profile: nextProfile,
  }
}

export const getRegistryFieldDefinitions = () => CANONICAL_FIELD_REGISTRY
