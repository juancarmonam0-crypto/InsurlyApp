import type {
  ApplicationFieldState,
  ApplicationRecord,
  ApplicationSnapshotRecord,
  ConflictRecord,
  CustomerRecord,
  FieldProvenance,
} from '../../domain/types'
import type { ApplicationWorkspace, PersistenceLoadOptions, PersistencePort } from './types'

interface StorageLike {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

interface LocalPersistenceData {
  customers: CustomerRecord[]
  applications: ApplicationRecord[]
  fieldStates: Array<{ agencyId: string; applicationId: string; fieldStates: ApplicationFieldState[] }>
  provenance: Array<{ agencyId: string; applicationId: string; provenance: FieldProvenance[] }>
  conflicts: Array<{ agencyId: string; applicationId: string; conflicts: ConflictRecord[] }>
  snapshots: ApplicationSnapshotRecord[]
}

const STORAGE_KEY = 'insurly-demo-workspace'

const defaultData = (): LocalPersistenceData => ({
  customers: [],
  applications: [],
  fieldStates: [],
  provenance: [],
  conflicts: [],
  snapshots: [],
})

const clone = <T>(value: T) => structuredClone(value)

const mergeById = <T extends { id: string }>(collection: T[], item: T) => {
  const next = collection.filter((entry) => entry.id !== item.id)
  next.push(clone(item))
  return next
}

const uniqueProvenance = (items: FieldProvenance[]) => {
  const seen = new Map<string, FieldProvenance>()
  items.forEach((item) => {
    seen.set(item.id, clone(item))
  })
  return [...seen.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp))
}

const readData = (storage: StorageLike | undefined) => {
  if (!storage) return defaultData()
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return defaultData()

  try {
    return JSON.parse(raw) as LocalPersistenceData
  } catch {
    return defaultData()
  }
}

const writeData = (storage: StorageLike | undefined, data: LocalPersistenceData) => {
  if (!storage) return
  storage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const getBrowserStorage = (): StorageLike | undefined => {
  if (typeof window === 'undefined') return undefined
  return window.localStorage
}

const mergeApplicationCollections = (data: LocalPersistenceData, application: ApplicationRecord) => {
  const fieldStates = data.fieldStates.filter(
    (entry) => !(entry.agencyId === application.agency_id && entry.applicationId === application.id),
  )
  fieldStates.push({ agencyId: application.agency_id, applicationId: application.id, fieldStates: clone(application.fieldStates) })

  const provenance = data.provenance.filter(
    (entry) => !(entry.agencyId === application.agency_id && entry.applicationId === application.id),
  )
  provenance.push({
    agencyId: application.agency_id,
    applicationId: application.id,
    provenance: uniqueProvenance(application.profile.fieldProvenance),
  })

  const conflicts = data.conflicts.filter(
    (entry) => !(entry.agencyId === application.agency_id && entry.applicationId === application.id),
  )
  conflicts.push({ agencyId: application.agency_id, applicationId: application.id, conflicts: clone(application.conflicts) })

  return { ...data, fieldStates, provenance, conflicts }
}

const hydrateApplication = (data: LocalPersistenceData, application: ApplicationRecord) => {
  const fieldStates = data.fieldStates.find(
    (entry) => entry.agencyId === application.agency_id && entry.applicationId === application.id,
  )?.fieldStates ?? application.fieldStates
  const provenance = data.provenance.find(
    (entry) => entry.agencyId === application.agency_id && entry.applicationId === application.id,
  )?.provenance ?? application.profile.fieldProvenance
  const conflicts = data.conflicts.find(
    (entry) => entry.agencyId === application.agency_id && entry.applicationId === application.id,
  )?.conflicts ?? application.conflicts

  return {
    ...clone(application),
    fieldStates: clone(fieldStates),
    conflicts: clone(conflicts),
    profile: {
      ...clone(application.profile),
      fieldProvenance: clone(provenance),
    },
  }
}

export const createLocalStoragePersistence = (storage: StorageLike | undefined = getBrowserStorage()): PersistencePort => ({
  mode: 'local',
  async loadWorkspace({ agencyId, applicationId, customerId, fallbackWorkspace }: PersistenceLoadOptions): Promise<ApplicationWorkspace> {
    const data = readData(storage)
    const storedApplication = data.applications.find((application) => application.agency_id === agencyId && application.id === applicationId)
    const storedCustomer = data.customers.find((customer) => customer.agency_id === agencyId && customer.id === customerId)
    const application = storedApplication ? hydrateApplication(data, storedApplication) : clone(fallbackWorkspace.application)
    const customer = storedCustomer ? clone(storedCustomer) : clone(fallbackWorkspace.customer)
    const snapshots = data.snapshots
      .filter((snapshot) => snapshot.agency_id === agencyId && snapshot.application_id === applicationId)
      .map((snapshot) => clone(snapshot))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

    return { application, customer, snapshots: snapshots.length > 0 ? snapshots : clone(fallbackWorkspace.snapshots) }
  },
  async listApplications(agencyId: string) {
    const data = readData(storage)
    return data.applications
      .filter((application) => application.agency_id === agencyId)
      .map((application) => hydrateApplication(data, application))
  },
  async saveCustomer(customer: CustomerRecord) {
    const data = readData(storage)
    writeData(storage, { ...data, customers: mergeById(data.customers, customer) })
  },
  async saveApplication(application: ApplicationRecord) {
    const data = mergeApplicationCollections(readData(storage), application)
    writeData(storage, { ...data, applications: mergeById(data.applications, application) })
  },
  async saveFieldStates(agencyId: string, applicationId: string, fieldStates: ApplicationFieldState[]) {
    const data = readData(storage)
    const next = data.fieldStates.filter((entry) => !(entry.agencyId === agencyId && entry.applicationId === applicationId))
    next.push({ agencyId, applicationId, fieldStates: clone(fieldStates) })
    writeData(storage, { ...data, fieldStates: next })
  },
  async appendProvenance(agencyId: string, applicationId: string, provenance: FieldProvenance[]) {
    const data = readData(storage)
    const existing = data.provenance.find((entry) => entry.agencyId === agencyId && entry.applicationId === applicationId)?.provenance ?? []
    const next = data.provenance.filter((entry) => !(entry.agencyId === agencyId && entry.applicationId === applicationId))
    next.push({ agencyId, applicationId, provenance: uniqueProvenance([...existing, ...provenance]) })
    writeData(storage, { ...data, provenance: next })
  },
  async saveConflicts(agencyId: string, applicationId: string, conflicts: ConflictRecord[]) {
    const data = readData(storage)
    const next = data.conflicts.filter((entry) => !(entry.agencyId === agencyId && entry.applicationId === applicationId))
    next.push({ agencyId, applicationId, conflicts: clone(conflicts) })
    writeData(storage, { ...data, conflicts: next })
  },
  async createSnapshot(snapshot: ApplicationSnapshotRecord) {
    const data = readData(storage)
    const nextSnapshots = [...data.snapshots, clone(snapshot)].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    writeData(storage, { ...data, snapshots: nextSnapshots })
    return clone(snapshot)
  },
  async listSnapshots(agencyId: string, applicationId: string) {
    const data = readData(storage)
    return data.snapshots
      .filter((snapshot) => snapshot.agency_id === agencyId && snapshot.application_id === applicationId)
      .map((snapshot) => clone(snapshot))
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
  },
  async loadSnapshot(agencyId: string, snapshotId: string) {
    const data = readData(storage)
    return data.snapshots.find((snapshot) => snapshot.agency_id === agencyId && snapshot.id === snapshotId) ?? null
  },
})

export const localStoragePersistence = createLocalStoragePersistence()
