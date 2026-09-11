import { describe, expect, test } from 'vitest'
import { demoApplication, demoCustomer } from '../data/mock/insurly'
import {
  findCanonicalDefinition,
  normalizeCanonicalKey,
  normalizeCanonicalValue,
} from '../domain/canonicalRegistry'
import type { ProfileFactMetadata } from '../domain/types'
import {
  extractFactsFromCustomerProfile,
  getProfileField,
  setProfileFact,
} from './customerProfileService'
import {
  createNewApplicationFromProfile,
  prefillApplicationFromProfile,
} from './profileMappingEngine'
import { createApplicationSnapshot } from './application/snapshotService'
import { buildAcord125Preview } from '../adapters/applications/acord125/adapter'
import { calculateReadiness } from './application/readinessEngine'
import { getApplicationDefinition } from '../domain/applicationDefinitions'
import { createLocalStoragePersistence } from '../adapters/persistence/localStoragePersistence'

class MemoryStorage {
  private readonly store = new Map<string, string>()
  getItem(key: string) { return this.store.get(key) ?? null }
  setItem(key: string, value: string) { this.store.set(key, value) }
}

describe('V0.4 Canonical Customer Profile & Knowledge Layer', () => {
  test('canonical field lookup maps direct keys and aliases correctly', () => {
    expect(normalizeCanonicalKey('business.annualRevenue')).toBe('business.annualRevenue')
    expect(normalizeCanonicalKey('business.annual_revenue')).toBe('business.annualRevenue')
    expect(normalizeCanonicalKey('annual_revenue')).toBe('business.annualRevenue')
    expect(normalizeCanonicalKey('fein')).toBe('business.fein')
    expect(normalizeCanonicalKey('naics_code')).toBe('business.naicsCode')
    expect(normalizeCanonicalKey('address_line_1')).toBe('location.addressLine1')

    const revDef = findCanonicalDefinition('annual_revenue')
    expect(revDef?.key).toBe('business.annualRevenue')
    expect(revDef?.valueType).toBe('currency')
  })

  test('canonical value normalization handles types safely', () => {
    expect(normalizeCanonicalValue('business.annualRevenue', '$150,000')).toBe(150000)
    expect(normalizeCanonicalValue('business.employeeCount', '12')).toBe(12)
    expect(normalizeCanonicalValue('customer.displayName', '  Acme Corp  ')).toBe('  Acme Corp  ')
  })

  test('extracts facts from customer profile including nested entities', () => {
    const customer = structuredClone(demoCustomer)
    const facts = extractFactsFromCustomerProfile(customer)

    expect(facts.length).toBeGreaterThan(5)
    const legalNameFact = facts.find((f) => f.fieldKey === 'business.legalName')
    expect(legalNameFact?.value).toBe('Cedar Ridge Services LLC')

    const revFact = facts.find((f) => f.fieldKey === 'business.annualRevenue')
    expect(revFact?.value).toBe(300000)
  })

  test('setProfileFact updates reusable truth and updates profile facts store', () => {
    const customer = structuredClone(demoCustomer)
    const newFact: ProfileFactMetadata = {
      id: 'fact-test-rev',
      agency_id: customer.agency_id,
      customer_id: customer.id,
      entityType: 'business',
      fieldKey: 'business.annualRevenue',
      value: 175000,
      sourceType: 'broker_entry',
      customerConfirmed: true,
      brokerVerified: true,
      updatedAt: new Date().toISOString(),
    }

    const updatedCustomer = setProfileFact(customer, newFact)
    expect(updatedCustomer.profile.business.annualRevenue).toBe(175000)

    const retrievedVal = getProfileField(updatedCustomer, 'business', 'business.annualRevenue')
    expect(retrievedVal).toBe(175000)
  })

  test('prefillApplicationFromProfile enforces safe prefill rules and precedence', () => {
    const customer = structuredClone(demoCustomer)
    const app = structuredClone(demoApplication)

    // Clear FEIN on application so it is empty
    const feinIndex = app.fieldStates.findIndex((f) => f.canonicalField === 'business.fein')
    if (feinIndex >= 0) {
      app.fieldStates.splice(feinIndex, 1)
    }

    // Customer profile has FEIN
    const updatedCustomer = setProfileFact(customer, {
      id: 'fact-fein',
      agency_id: customer.agency_id,
      customer_id: customer.id,
      entityType: 'business',
      fieldKey: 'business.fein',
      value: '12-3456789',
      sourceType: 'customer_answer',
      customerConfirmed: true,
      brokerVerified: false,
      updatedAt: new Date().toISOString(),
    })

    // Confirm legal name on application to protect it
    const legalState = app.fieldStates.find((f) => f.canonicalField === 'business.legalName')
    if (legalState) {
      legalState.customerConfirmed = true
      legalState.brokerVerified = true
    }

    const prefilledApp = prefillApplicationFromProfile(app, updatedCustomer)

    // FEIN was prefilled
    const newFeinState = prefilledApp.fieldStates.find((f) => f.canonicalField === 'business.fein')
    expect(newFeinState?.selectedValue).toBe('12-3456789')
    expect(newFeinState?.selectedEvidenceId).toBe('existing_profile')

    // Confirmed legal name on application was NOT overwritten by profile prefill
    const legalNameState = prefilledApp.fieldStates.find((f) => f.canonicalField === 'business.legalName')
    expect(legalNameState?.brokerVerified).toBe(true)
  })

  test('createNewApplicationFromProfile initializes a clean app without old conflicts', () => {
    const customer = structuredClone(demoCustomer)

    // Add a fact to customer profile
    customer.profile.business.annualRevenue = 250000

    const newApp = createNewApplicationFromProfile(customer, 'commercial-acord125', 1, customer.agency_id)

    expect(newApp.customerId).toBe(customer.id)
    expect(newApp.status).toBe('collecting_information')
    expect(newApp.conflicts).toHaveLength(0) // Clean slate! No copied conflicts!

    const revState = newApp.fieldStates.find((f) => f.canonicalField === 'business.annualRevenue')
    expect(revState?.selectedValue).toBe(250000)
  })

  test('profile changes do NOT mutate historical prepared application snapshots', async () => {
    const adapter = createLocalStoragePersistence(new MemoryStorage())
    const customer = structuredClone(demoCustomer)
    const app = structuredClone(demoApplication)

    const definition = getApplicationDefinition(app.definitionId, app.definitionVersion)
    const readiness = calculateReadiness(app, definition)
    const snapshot = createApplicationSnapshot(app, readiness, buildAcord125Preview(app))

    await adapter.createSnapshot(snapshot)

    // Update customer profile truth after snapshot creation
    const updatedCustomer = setProfileFact(customer, {
      id: 'fact-rev-after',
      agency_id: customer.agency_id,
      customer_id: customer.id,
      entityType: 'business',
      fieldKey: 'business.annualRevenue',
      value: 999999,
      sourceType: 'broker_entry',
      customerConfirmed: true,
      brokerVerified: true,
      updatedAt: new Date().toISOString(),
    })
    await adapter.saveCustomer(updatedCustomer)

    // Load original snapshot
    const loadedSnapshot = await adapter.loadSnapshot(snapshot.agency_id, snapshot.id)

    // Snapshot JSON and SHA-256 hash are 100% untouched!
    expect(loadedSnapshot?.snapshotHash).toBe(snapshot.snapshotHash)

    const snapRevState = loadedSnapshot?.snapshot.fieldStates.find((f) => f.canonicalField === 'business.annualRevenue')
    expect(snapRevState?.selectedValue).not.toBe(999999)
  })

  test('enforces strict multi-tenant agency boundary for profile facts', () => {
    const tenantA = structuredClone(demoCustomer)
    tenantA.agency_id = 'agency-tenant-a'
    tenantA.id = 'customer-tenant-a'

    const tenantB = structuredClone(demoCustomer)
    tenantB.agency_id = 'agency-tenant-b'
    tenantB.id = 'customer-tenant-b'

    const updatedA = setProfileFact(tenantA, {
      id: 'fact-a',
      agency_id: 'agency-tenant-a',
      customer_id: 'customer-tenant-a',
      entityType: 'business',
      fieldKey: 'business.legalName',
      value: 'Tenant A Corp',
      sourceType: 'broker_entry',
      customerConfirmed: true,
      brokerVerified: true,
      updatedAt: new Date().toISOString(),
    })

    const factsB = extractFactsFromCustomerProfile(tenantB)
    const tenantAFactInB = factsB.find((f) => f.agency_id === 'agency-tenant-a')

    expect(tenantAFactInB).toBeUndefined()
    expect(updatedA.agency_id).toBe('agency-tenant-a')
    expect(tenantB.agency_id).toBe('agency-tenant-b')
  })
})
