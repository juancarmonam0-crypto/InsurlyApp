import { describe, expect, test } from 'vitest'
import { createLocalStoragePersistence } from '../adapters/persistence/localStoragePersistence'
import { demoApplication, demoCustomer } from '../data/mock/insurly'
import { recalculateApplication } from './application/workflow'
import { persistWorkspaceWithAdapter, type ApplicationWorkspace } from './storage'

class MemoryStorage {
  private readonly store = new Map<string, string>()

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }
}

const createWorkspace = (): ApplicationWorkspace => ({
  customer: structuredClone(demoCustomer),
  application: recalculateApplication(structuredClone(demoApplication)),
  snapshots: [],
})

describe('storage coordinator', () => {
  test('persistWorkspace saves the full workspace end-to-end', async () => {
    const adapter = createLocalStoragePersistence(new MemoryStorage())
    const workspace = createWorkspace()

    await persistWorkspaceWithAdapter(adapter, workspace)

    const loaded = await adapter.loadWorkspace({
      agencyId: workspace.application.agency_id,
      applicationId: workspace.application.id,
      customerId: workspace.customer.id,
      fallbackWorkspace: workspace,
    })

    expect(loaded.customer.displayName).toBe(workspace.customer.displayName)
    expect(loaded.application.fieldStates).toEqual(workspace.application.fieldStates)
    expect(loaded.application.profile.fieldProvenance).toEqual(workspace.application.profile.fieldProvenance)
    expect(loaded.application.conflicts).toEqual(workspace.application.conflicts)
  })
})
