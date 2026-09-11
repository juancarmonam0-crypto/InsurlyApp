import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { SurfaceCard } from '../../components/SurfaceCard'
import { getAvailableDefinitions } from '../../domain/applicationDefinitions'
import { CANONICAL_FIELD_REGISTRY } from '../../domain/canonicalRegistry'
import type { ProfileEntityKind, ProfileFactMetadata } from '../../domain/types'
import { getAvailableCanonicalFacts } from '../../services/customerProfileService'
import { evaluateProfileCoverage } from '../../services/profileMappingEngine'
import { useAppState } from '../../state/useAppState'

export const BrokerCustomerProfilePage = () => {
  const { customer, updateCustomerProfileFact, startNewApplicationForCustomer, application } = useAppState()
  const navigate = useNavigate()

  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>('commercial-acord125')
  const [activeTab, setActiveTab] = useState<'truth' | 'facts' | 'applications'>('truth')

  // Edit Fact Form State
  const [editingFactKey, setEditingFactKey] = useState<string>('')
  const [editingEntityType, setEditingEntityType] = useState<ProfileEntityKind>('business')
  const [editingValue, setEditingValue] = useState<string>('')
  const [editingConfirmed, setEditingConfirmed] = useState<boolean>(true)
  const [editingVerified, setEditingVerified] = useState<boolean>(true)
  const [newApplicationNotice, setNewApplicationNotice] = useState<string | null>(null)

  const availableDefinitions = useMemo(() => getAvailableDefinitions(), [])
  const selectedDefinition = useMemo(
    () => availableDefinitions.find((def) => def.id === selectedDefinitionId) ?? availableDefinitions[0],
    [availableDefinitions, selectedDefinitionId],
  )

  const coverage = useMemo(
    () => evaluateProfileCoverage(customer, selectedDefinition),
    [customer, selectedDefinition],
  )

  const facts = useMemo(() => getAvailableCanonicalFacts(customer), [customer])

  const handleSaveFact = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFactKey || !editingValue.trim()) return

    const parsedValue = isNaN(Number(editingValue)) ? editingValue : Number(editingValue)

    const fact: ProfileFactMetadata = {
      id: `fact-${customer.id}-${editingEntityType}-${editingFactKey}`,
      agency_id: customer.agency_id,
      customer_id: customer.id,
      entityType: editingEntityType,
      entityId: '',
      fieldKey: editingFactKey,
      value: parsedValue,
      sourceType: 'broker_entry',
      customerConfirmed: editingConfirmed,
      brokerVerified: editingVerified,
      updatedAt: new Date().toISOString(),
      metadata: { label: editingFactKey },
    }

    updateCustomerProfileFact(fact)
    setEditingFactKey('')
    setEditingValue('')
  }

  const handleStartNewApplication = () => {
    startNewApplicationForCustomer(selectedDefinition.id, selectedDefinition.version)
    setNewApplicationNotice(`Started new ${selectedDefinition.lineOfBusiness} application prefilled from customer profile!`)
    setTimeout(() => {
      navigate('/broker/applications/nexo')
    }, 1200)
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Canonical Customer Profile · V0.4</p>
          <h1>{customer.displayName}</h1>
          <p className="lede">
            Reusable customer truth layer. Changes here propagate to new applications without mutating historical application snapshots.
          </p>
        </div>
        <div className="button-row">
          <Link className="button button--secondary" to="/broker/dashboard">Back to Dashboard</Link>
          <button
            className="button"
            type="button"
            onClick={() => setActiveTab('applications')}
          >
            Start New Application
          </button>
        </div>
      </div>

      {newApplicationNotice ? (
        <div className="surface-card" style={{ borderLeft: '4px solid #10b981', padding: '1rem' }}>
          <strong>✓ {newApplicationNotice}</strong>
          <p className="muted">Redirecting to application workspace...</p>
        </div>
      ) : null}

      <div className="pill-row">
        <button
          className={`pill ${activeTab === 'truth' ? 'pill--active' : ''}`}
          type="button"
          onClick={() => setActiveTab('truth')}
        >
          Customer Profile Truth
        </button>
        <button
          className={`pill ${activeTab === 'facts' ? 'pill--active' : ''}`}
          type="button"
          onClick={() => setActiveTab('facts')}
        >
          Canonical Fact Registry ({facts.length})
        </button>
        <button
          className={`pill ${activeTab === 'applications' ? 'pill--active' : ''}`}
          type="button"
          onClick={() => setActiveTab('applications')}
        >
          Application Coverage & Prefill ({coverage.coveragePercent}%)
        </button>
      </div>

      {activeTab === 'truth' && (
        <div className="stack-lg">
          <div className="grid two-up">
            <SurfaceCard title="Business Information" eyebrow="Reusable Business Entity">
              <ul className="list-clean">
                <li><strong>Legal Name:</strong> {customer.profile.business.legalName || 'Not specified'}</li>
                <li><strong>DBA:</strong> {customer.profile.business.dba || 'None'}</li>
                <li><strong>Entity Type:</strong> {customer.profile.business.entityType || 'Unspecified'}</li>
                <li><strong>FEIN:</strong> {customer.profile.business.fein || 'Missing'}</li>
                <li><strong>Annual Revenue:</strong> ${customer.profile.business.annualRevenue.toLocaleString()}</li>
                <li><strong>Employees:</strong> {customer.profile.business.employeeCount}</li>
                <li><strong>NAICS Code:</strong> {customer.profile.business.naicsCode || 'Unassigned'}</li>
              </ul>
            </SurfaceCard>

            <SurfaceCard title="Contact & Primary Account" eyebrow="Customer Details">
              <ul className="list-clean">
                <li><strong>Display Name:</strong> {customer.displayName}</li>
                <li><strong>Email:</strong> {customer.email || 'None'}</li>
                <li><strong>Phone:</strong> {customer.phone || 'None'}</li>
                <li><strong>Preferred Channel:</strong> {customer.profile.preferredChannel}</li>
                <li><strong>Agency ID:</strong> {customer.agency_id}</li>
                <li><strong>Customer ID:</strong> {customer.id}</li>
              </ul>
            </SurfaceCard>
          </div>

          <div className="grid two-up">
            <SurfaceCard title="Key Personnel" eyebrow="People Entities">
              {customer.profile.people.length === 0 ? (
                <p className="muted">No personnel on file.</p>
              ) : (
                <ul className="list-clean list-clean--spaced">
                  {customer.profile.people.map((p) => (
                    <li key={p.id}>
                      <strong>{p.fullName}</strong> — {p.role} ({p.email || 'No email'})
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>

            <SurfaceCard title="Locations & Property" eyebrow="Location Entities">
              {customer.profile.locations.length === 0 ? (
                <p className="muted">No locations on file.</p>
              ) : (
                <ul className="list-clean list-clean--spaced">
                  {customer.profile.locations.map((loc) => (
                    <li key={loc.id}>
                      <strong>{loc.addressLine1}</strong>, {loc.city}, {loc.state} {loc.postalCode} ({loc.occupancy})
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>
          </div>

          <div className="grid two-up">
            <SurfaceCard title="Vehicles & Equipment" eyebrow="Schedule of Assets">
              {customer.profile.vehicles.length === 0 ? (
                <p className="muted">No vehicles on file.</p>
              ) : (
                <ul className="list-clean list-clean--spaced">
                  {customer.profile.vehicles.map((v) => (
                    <li key={v.id}>
                      <strong>{v.year} {v.make} {v.model}</strong> — VIN: {v.vin} ({v.usage})
                    </li>
                  ))}
                </ul>
              )}
            </SurfaceCard>

            <SurfaceCard title="Current Insurance & Loss History" eyebrow="Prior Coverage">
              <ul className="list-clean">
                <li><strong>Prior Carrier:</strong> {customer.profile.currentInsurance.carrierName || 'None'}</li>
                <li><strong>Expiration Date:</strong> {customer.profile.currentInsurance.expirationDate || 'N/A'}</li>
                <li><strong>Limits:</strong> {customer.profile.currentInsurance.limits || 'N/A'}</li>
                <li><strong>Prior Premium:</strong> ${customer.profile.currentInsurance.premium.toLocaleString()}</li>
                <li><strong>Loss Records:</strong> {customer.profile.lossHistory.length} incident(s) recorded</li>
              </ul>
            </SurfaceCard>
          </div>
        </div>
      )}

      {activeTab === 'facts' && (
        <div className="stack-lg">
          <SurfaceCard title="Add / Update Reusable Customer Fact" eyebrow="Broker Fact Entry">
            <form onSubmit={handleSaveFact} className="stack-sm">
              <div className="grid two-up">
                <div>
                  <label htmlFor="factKey" className="muted">Select Canonical Field</label>
                  <select
                    id="factKey"
                    className="button button--secondary w-full"
                    value={editingFactKey}
                    onChange={(e) => {
                      const key = e.target.value
                      setEditingFactKey(key)
                      const reg = CANONICAL_FIELD_REGISTRY.find((d) => d.key === key)
                      if (reg) setEditingEntityType(reg.entityType)
                    }}
                  >
                    <option value="">-- Choose canonical field --</option>
                    {CANONICAL_FIELD_REGISTRY.map((def) => (
                      <option key={def.key} value={def.key}>
                        {def.label} ({def.key})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="factValue" className="muted">Fact Value</label>
                  <input
                    id="factValue"
                    type="text"
                    className="button button--secondary w-full"
                    placeholder="Enter reusable truth value..."
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                  />
                </div>
              </div>

              <div className="button-row button-row--wrap">
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editingConfirmed}
                    onChange={(e) => setEditingConfirmed(e.target.checked)}
                  />
                  Customer Confirmed
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={editingVerified}
                    onChange={(e) => setEditingVerified(e.target.checked)}
                  />
                  Broker Verified
                </label>

                <button className="button" type="submit" disabled={!editingFactKey || !editingValue.trim()}>
                  Save Canonical Fact
                </button>
              </div>
            </form>
          </SurfaceCard>

          <SurfaceCard title="Extracted Canonical Fact Store" eyebrow="Active Customer Knowledge">
            <div className="table-like">
              {facts.map((fact) => (
                <div className="table-like__row provenance-row" key={fact.id}>
                  <div>
                    <strong>{String(fact.metadata?.label ?? fact.fieldKey)}</strong>
                    <p className="muted">{fact.fieldKey} ({fact.entityType})</p>
                  </div>
                  <div>
                    <strong>{String(fact.value)}</strong>
                    <p className="muted">Source: {fact.sourceType}</p>
                  </div>
                  <div>
                    <div className="pill-row">
                      {fact.customerConfirmed ? <span className="pill pill--active">Customer Confirmed</span> : null}
                      {fact.brokerVerified ? <span className="pill">Broker Verified</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {activeTab === 'applications' && (
        <div className="stack-lg">
          <SurfaceCard title="Application Definition Coverage" eyebrow="Automated Prefill Evaluator">
            <div className="stack-sm">
              <div className="grid two-up">
                <div>
                  <label htmlFor="defSelect" className="muted">Select Target Application Definition</label>
                  <select
                    id="defSelect"
                    className="button button--secondary w-full"
                    value={selectedDefinitionId}
                    onChange={(e) => setSelectedDefinitionId(e.target.value)}
                  >
                    {availableDefinitions.map((def) => (
                      <option key={def.id} value={def.id}>
                        {def.lineOfBusiness} ({def.id} v{def.version})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="hero-stats">
                  <div>
                    <strong>{coverage.coveragePercent}%</strong>
                    <span>Profile Coverage</span>
                  </div>
                  <div>
                    <strong>{coverage.prefillableCount}/{coverage.totalRequirements}</strong>
                    <span>Prefillable Fields</span>
                  </div>
                </div>
              </div>

              <div className="button-row">
                <button
                  className="button"
                  type="button"
                  onClick={handleStartNewApplication}
                >
                  Start New {selectedDefinition.lineOfBusiness} Application From Profile
                </button>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Requirements Prefill Breakdown" eyebrow={selectedDefinition.lineOfBusiness}>
            <div className="table-like">
              {coverage.items.map(({ requirement, fact, status }) => (
                <div className="table-like__row provenance-row" key={requirement.id}>
                  <div>
                    <strong>{requirement.label}</strong>
                    <p className="muted">{requirement.canonicalField} ({requirement.section})</p>
                  </div>
                  <div>
                    <strong>{fact ? String(fact.value) : 'Missing in Customer Profile'}</strong>
                    <p className="muted">{fact ? `Source: ${fact.sourceType}` : 'Will require intake'}</p>
                  </div>
                  <div>
                    <StatusBadge status={status === 'covered' ? 'ready_to_submit' : 'draft'} />
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard title="Current Working Application" eyebrow="Active Workspace Context">
            <div className="application-row">
              <div>
                <strong>{application.lineOfBusiness} ({application.id})</strong>
                <p className="muted">Status: {application.status} · Completion: {application.completion}%</p>
              </div>
              <div className="button-row">
                <Link className="button button--secondary" to="/broker/applications/nexo">Open Active Application</Link>
              </div>
            </div>
          </SurfaceCard>
        </div>
      )}
    </div>
  )
}
