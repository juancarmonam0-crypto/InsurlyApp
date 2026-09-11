import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoApplication, demoCustomer } from '../data/mock/insurly'
import type { ApplicationRecord, ApplicationSnapshotRecord, CustomerRecord, PersistenceState } from '../domain/types'
import { buildAcord125Preview } from '../adapters/applications/acord125/adapter'
import { getApplicationDefinition } from '../domain/applicationDefinitions'
import {
  answerRequirement,
  applyCustomerReviewChange,
  confirmCustomerReview,
  markGenerated,
  processDocumentIntake,
  recalculateApplication,
  resolveApplicationConflict,
  verifyApplication,
} from '../services/application/workflow'
import { calculateReadiness } from '../services/application/readinessEngine'
import { createApplicationSnapshot } from '../services/application/snapshotService'
import {
  createSnapshotRecord,
  getPersistenceSummary,
  loadWorkspace,
  persistWorkspace,
  type ApplicationWorkspace,
} from '../services/storage'
import { AppStateContext, type AppStateValue } from './AppStateContext'

const createSeedApplication = () => structuredClone(demoApplication)
const createSeedCustomer = () => structuredClone(demoCustomer)
const createSeedWorkspace = (): ApplicationWorkspace => ({
  customer: createSeedCustomer(),
  application: createSeedApplication(),
  snapshots: [],
})

const normalizeApplication = (application: ApplicationRecord) => recalculateApplication(application)

const syncCustomerFromApplication = (customer: CustomerRecord, application: ApplicationRecord): CustomerRecord => ({
  ...customer,
  displayName: application.customerName,
  updatedAt: application.updatedAt,
  profile: {
    ...customer.profile,
    preferredChannel: application.profile.preferredChannel,
    business: structuredClone(application.profile.business),
    people: structuredClone(application.profile.people),
    locations: structuredClone(application.profile.locations),
    vehicles: structuredClone(application.profile.vehicles),
    currentInsurance: structuredClone(application.profile.currentInsurance),
    lossHistory: structuredClone(application.profile.lossHistory),
    documents: structuredClone(application.profile.documents),
  },
})

const terminalStatuses = new Set(['submitted', 'quoted', 'bound', 'declined', 'closed'])

import { setProfileFact } from '../services/customerProfileService'
import { createNewApplicationFromProfile, prefillApplicationFromProfile } from '../services/profileMappingEngine'
import type { ProfileFactMetadata } from '../domain/types'

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const seedWorkspace = useMemo(() => createSeedWorkspace(), [])
  const [application, setApplication] = useState<ApplicationRecord>(normalizeApplication(seedWorkspace.application))
  const [customer, setCustomer] = useState<CustomerRecord>(seedWorkspace.customer)
  const [snapshots, setSnapshots] = useState<ApplicationSnapshotRecord[]>([])
  const [persistenceState, setPersistenceState] = useState<PersistenceState>('loading')
  const [persistenceError, setPersistenceError] = useState<string | undefined>()
  const persistenceSummary = useMemo(() => getPersistenceSummary(), [])
  const [hasLoadedWorkspace, setHasLoadedWorkspace] = useState(false)

  useEffect(() => {
    let active = true

    const hydrate = async () => {
      if (persistenceSummary.state === 'error') {
        if (!active) return
        setPersistenceState('error')
        setPersistenceError(persistenceSummary.error)
        setHasLoadedWorkspace(true)
        return
      }

      try {
        const workspace = await loadWorkspace(seedWorkspace)
        if (!active) return
        setApplication(normalizeApplication(workspace.application))
        setCustomer(workspace.customer)
        setSnapshots(workspace.snapshots)
        setPersistenceState('ready')
        setPersistenceError(undefined)
      } catch (error) {
        if (!active) return
        setPersistenceState('error')
        setPersistenceError(error instanceof Error ? error.message : 'Unable to load persistence workspace.')
      } finally {
        if (active) setHasLoadedWorkspace(true)
      }
    }

    void hydrate()

    return () => {
      active = false
    }
  }, [persistenceSummary.error, persistenceSummary.state, seedWorkspace])

  useEffect(() => {
    if (!hasLoadedWorkspace || persistenceState !== 'ready') return

    void persistWorkspace({ application, customer, snapshots }).catch((error) => {
      setPersistenceState('error')
      setPersistenceError(error instanceof Error ? error.message : 'Unable to persist workspace state.')
    })
  }, [application, customer, snapshots, hasLoadedWorkspace, persistenceState])

  const readiness = useMemo(() => {
    const definition = getApplicationDefinition(application.definitionId, application.definitionVersion)
    return calculateReadiness(application, definition)
  }, [application])

  const latestSnapshot = snapshots.at(-1) ?? null

  const updateFromApplication = (nextApplication: ApplicationRecord) => {
    const normalized = normalizeApplication({
      ...nextApplication,
      updatedAt: new Date().toISOString(),
    })
    setApplication(normalized)
    setCustomer((current) => syncCustomerFromApplication(current, normalized))
  }

  const value = useMemo<AppStateValue>(
    () => ({
      application,
      customer,
      snapshots,
      latestSnapshot,
      acordPreview: buildAcord125Preview(application),
      readiness,
      persistenceMode: persistenceSummary.mode,
      persistenceState,
      persistenceError,
      processDocuments: () => updateFromApplication(processDocumentIntake(application)),
      answerWizardQuestion: (field, value) => updateFromApplication(answerRequirement(application, field, value)),
      resetDemo: () => {
        const workspace = createSeedWorkspace()
        setApplication(normalizeApplication(workspace.application))
        setCustomer(workspace.customer)
        setSnapshots([])
        setPersistenceState(persistenceSummary.state === 'error' ? 'error' : 'ready')
      },
      confirmCustomerReview: () => updateFromApplication(confirmCustomerReview(application)),
      confirmRevenueChange: () => updateFromApplication(applyCustomerReviewChange(application, 'business.annualRevenue', 150000)),
      resolveConflict: (conflictId, action, correctedValue) =>
        updateFromApplication(resolveApplicationConflict(application, conflictId, action, correctedValue)),
      markBrokerVerified: () => updateFromApplication(verifyApplication(application)),
      markGenerated: async () => {
        const generatedApplication = markGenerated(application)
        const generatedReadiness = calculateReadiness(
          generatedApplication,
          getApplicationDefinition(generatedApplication.definitionId, generatedApplication.definitionVersion),
        )

        if (!(generatedReadiness.ready || terminalStatuses.has(generatedApplication.status))) {
          updateFromApplication(generatedApplication)
          return
        }

        const snapshot = createApplicationSnapshot(generatedApplication, generatedReadiness, buildAcord125Preview(generatedApplication))
        const persistedSnapshot = await createSnapshotRecord(snapshot)
        updateFromApplication(generatedApplication)
        setSnapshots((current) => [...current, persistedSnapshot].sort((left, right) => left.createdAt.localeCompare(right.createdAt)))
      },
      updateCustomerProfileFact: (fact: ProfileFactMetadata) => {
        setCustomer((current) => {
          const updatedCustomer = setProfileFact(current, fact)
          return updatedCustomer
        })
      },
      applyProfilePrefill: () => {
        setApplication((currentApp) => {
          const prefilled = prefillApplicationFromProfile(currentApp, customer)
          return normalizeApplication(prefilled)
        })
      },
      startNewApplicationForCustomer: (definitionId: string, version: number) => {
        const newApp = createNewApplicationFromProfile(customer, definitionId, version, customer.agency_id)
        setApplication(normalizeApplication(newApp))
      },
    }),
    [application, customer, latestSnapshot, persistenceError, persistenceState, persistenceSummary.mode, persistenceSummary.state, readiness, snapshots],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
