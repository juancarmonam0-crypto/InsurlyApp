import type {
  ApplicationFieldState,
  ApplicationRecord,
  ApplicationSnapshotRecord,
  ConflictRecord,
  CustomerRecord,
  FieldProvenance,
  PersistenceMode,
} from '../../domain/types'

export interface ApplicationWorkspace {
  customer: CustomerRecord
  application: ApplicationRecord
  snapshots: ApplicationSnapshotRecord[]
}

export interface PersistenceContext {
  agencyId: string
  applicationId: string
  customerId: string
}

export interface PersistenceLoadOptions extends PersistenceContext {
  fallbackWorkspace: ApplicationWorkspace
}

export interface PersistencePort {
  readonly mode: PersistenceMode
  loadWorkspace: (options: PersistenceLoadOptions) => Promise<ApplicationWorkspace>
  listApplications: (agencyId: string) => Promise<ApplicationRecord[]>
  saveCustomer: (customer: CustomerRecord) => Promise<void>
  saveApplication: (application: ApplicationRecord) => Promise<void>
  saveFieldStates: (agencyId: string, applicationId: string, fieldStates: ApplicationFieldState[]) => Promise<void>
  appendProvenance: (agencyId: string, applicationId: string, provenance: FieldProvenance[]) => Promise<void>
  saveConflicts: (agencyId: string, applicationId: string, conflicts: ConflictRecord[]) => Promise<void>
  createSnapshot: (snapshot: ApplicationSnapshotRecord) => Promise<ApplicationSnapshotRecord>
  listSnapshots: (agencyId: string, applicationId: string) => Promise<ApplicationSnapshotRecord[]>
  loadSnapshot: (agencyId: string, snapshotId: string) => Promise<ApplicationSnapshotRecord | null>
}
