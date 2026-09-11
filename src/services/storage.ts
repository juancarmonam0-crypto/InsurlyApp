import type { ApplicationSnapshotRecord, CustomerRecord, PersistenceMode, PersistenceState } from '../domain/types'
import { localStoragePersistence } from '../adapters/persistence/localStoragePersistence'
import { createSupabasePersistence } from '../adapters/persistence/supabasePersistence'
import { getSupabaseBrowserConfig, isSupabaseConfigured } from '../adapters/persistence/supabaseClient'
import type { ApplicationWorkspace, PersistencePort } from '../adapters/persistence/types'

interface PersistenceSummary {
  mode: PersistenceMode
  state: PersistenceState
  error?: string
}

let persistence: PersistencePort | null = null

const resolvePersistence = (): PersistencePort => {
  if (persistence) return persistence

  const config = getSupabaseBrowserConfig()
  const configured = isSupabaseConfigured(config)

  if (config.provider === 'supabase') {
    if (!configured) {
      throw new Error('Supabase persistence was explicitly requested but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.')
    }

    persistence = createSupabasePersistence()
    return persistence
  }

  if (config.provider === 'auto' && configured) {
    persistence = createSupabasePersistence()
    return persistence
  }

  persistence = localStoragePersistence
  return persistence
}

export const getPersistenceSummary = (): PersistenceSummary => {
  try {
    const adapter = resolvePersistence()
    return { mode: adapter.mode, state: 'ready' }
  } catch (error) {
    return {
      mode: 'local',
      state: 'error',
      error: error instanceof Error ? error.message : 'Unknown persistence error.',
    }
  }
}

export const loadWorkspace = async (workspace: ApplicationWorkspace) => {
  const adapter = resolvePersistence()
  return adapter.loadWorkspace({
    agencyId: workspace.application.agency_id,
    applicationId: workspace.application.id,
    customerId: workspace.customer.id,
    fallbackWorkspace: workspace,
  })
}

export const listApplications = async (agencyId: string) => resolvePersistence().listApplications(agencyId)

export const persistWorkspaceWithAdapter = async (adapter: PersistencePort, workspace: ApplicationWorkspace) => {
  await adapter.saveCustomer(workspace.customer)
  await adapter.saveApplication(workspace.application)
  await adapter.saveFieldStates(workspace.application.agency_id, workspace.application.id, workspace.application.fieldStates)
  await adapter.appendProvenance(workspace.application.agency_id, workspace.application.id, workspace.application.profile.fieldProvenance)
  await adapter.saveConflicts(workspace.application.agency_id, workspace.application.id, workspace.application.conflicts)
}

export const persistWorkspace = async (workspace: ApplicationWorkspace) => {
  await persistWorkspaceWithAdapter(resolvePersistence(), workspace)
}

export const createSnapshotRecord = async (snapshot: ApplicationSnapshotRecord) => resolvePersistence().createSnapshot(snapshot)

export const listSnapshots = async (agencyId: string, applicationId: string) => resolvePersistence().listSnapshots(agencyId, applicationId)

export const loadSnapshot = async (agencyId: string, snapshotId: string) => resolvePersistence().loadSnapshot(agencyId, snapshotId)

export const resetPersistenceAdapterForTests = () => {
  persistence = null
}

export type { ApplicationWorkspace, CustomerRecord, PersistenceSummary }
