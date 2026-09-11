import { createContext } from 'react'
import type {
  ApplicationRecord,
  ApplicationSnapshotRecord,
  ConflictResolutionType,
  CustomerRecord,
  FieldValue,
  PersistenceMode,
  PersistenceState,
  ProfileFactMetadata,
  ReadinessResult,
} from '../domain/types'
import { buildAcord125Preview } from '../adapters/applications/acord125/adapter'

export interface AppStateValue {
  application: ApplicationRecord
  customer: CustomerRecord
  snapshots: ApplicationSnapshotRecord[]
  latestSnapshot: ApplicationSnapshotRecord | null
  acordPreview: ReturnType<typeof buildAcord125Preview>
  readiness: ReadinessResult
  persistenceMode: PersistenceMode
  persistenceState: PersistenceState
  persistenceError?: string
  processDocuments: () => void | Promise<void>
  answerWizardQuestion: (field: string, value: string | number) => void | Promise<void>
  resetDemo: () => void | Promise<void>
  confirmCustomerReview: () => void | Promise<void>
  confirmRevenueChange: () => void | Promise<void>
  resolveConflict: (conflictId: string, action: ConflictResolutionType, correctedValue?: FieldValue) => void | Promise<void>
  markBrokerVerified: () => void | Promise<void>
  markGenerated: () => void | Promise<void>
  updateCustomerProfileFact: (fact: ProfileFactMetadata) => void | Promise<void>
  applyProfilePrefill: () => void | Promise<void>
  startNewApplicationForCustomer: (definitionId: string, version: number) => void | Promise<void>
}

export const AppStateContext = createContext<AppStateValue | null>(null)
