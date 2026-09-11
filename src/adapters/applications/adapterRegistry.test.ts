import { describe, expect, it } from 'vitest'
import { getApplicationAdapter, getAvailableAdapters, findAdapterForLineOfBusiness } from './registry'
import { prepareApplicationPackage, createApplicationSnapshot } from '../../services/application/snapshotService'
import { mockApplication } from '../../data/mock/insurly'
import { calculateReadiness } from '../../services/application/readinessEngine'
import { getApplicationDefinition } from '../../domain/applicationDefinitions'

describe('Application Adapter Registry (Sensible Pattern)', () => {
  it('registers supported ACORD form editions', () => {
    const adapters = getAvailableAdapters()
    expect(adapters.length).toBeGreaterThanOrEqual(2)

    const ids = adapters.map((a) => a.id)
    expect(ids).toContain('acord-125:2016-03')
    expect(ids).toContain('acord-125:2014-12')
  })

  it('retrieves an adapter by edition id', () => {
    const adapter2016 = getApplicationAdapter('acord-125:2016-03')
    expect(adapter2016.formType).toBe('ACORD 125')
    expect(adapter2016.edition).toBe('2016/03')
    expect(adapter2016.mappings.length).toBeGreaterThan(10)

    const adapter2014 = getApplicationAdapter('acord-125:2014-12')
    expect(adapter2014.formType).toBe('ACORD 125')
    expect(adapter2014.edition).toBe('2014/12')
  })

  it('safely rejects unsupported adapter requests with a descriptive error', () => {
    expect(() => getApplicationAdapter('unsupported-form-xyz')).toThrowError(/Unsupported application adapter version/)
  })

  it('finds adapter matching line of business and preferred edition', () => {
    const adapter = findAdapterForLineOfBusiness('Commercial General Liability', '2014/12')
    expect(adapter.edition).toBe('2014/12')
  })

  it('records adapterId and adapterVersion in generated snapshot payloads', () => {
    const definition = getApplicationDefinition(mockApplication.definitionId, mockApplication.definitionVersion)
    const readiness = calculateReadiness(mockApplication, definition)
    const adapter = getApplicationAdapter('acord-125:2016-03')
    const acordPreview = adapter.buildPreview(mockApplication)

    const snapshotRecord = createApplicationSnapshot(mockApplication, readiness, acordPreview, 'test-broker', adapter.id)

    expect(snapshotRecord.adapterId).toBe('acord-125:2016-03')
    expect(snapshotRecord.adapterVersion).toBe('2016/03')
    expect(snapshotRecord.snapshot.adapterId).toBe('acord-125:2016-03')
    expect(snapshotRecord.snapshot.adapterVersion).toBe('2016/03')
    expect(snapshotRecord.snapshotHash).toMatch(/^sha256-[0-9a-f]{64}$/)
  })
})
