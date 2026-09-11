import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SurfaceCard } from '../../components/SurfaceCard'
import { StatusBadge } from '../../components/StatusBadge'
import { brokerMetrics } from '../../data/mock/insurly'
import { getFieldValue } from '../../services/application/fieldAccess'
import { useAppState } from '../../state/useAppState'

const brokerNav = ['Dashboard', 'Customers', 'Applications', 'Needs Review', 'Documents', 'Analytics', 'Settings']

export const BrokerDashboardPage = () => {
  const { application, customer, readiness, persistenceMode, persistenceState } = useAppState()

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Broker portal</p>
          <h1>Operational dashboard</h1>
          <p className="lede">Desktop-first navigation with mobile-friendly cards for actionable submission readiness.</p>
        </div>
        <div className="pill-row">{brokerNav.map((item) => <span key={item} className="pill">{item}</span>)}</div>
      </div>
      <div className="grid metrics-grid">
        {brokerMetrics.map((metric) => (
          <SurfaceCard key={metric.label} title={metric.label}>
            <div className="metric-value">{metric.count}</div>
          </SurfaceCard>
        ))}
      </div>
      <SurfaceCard title="Applications needing attention" eyebrow="Needs review queue">
        <div className="application-row">
          <div>
            <strong>{application.customerName}</strong>
            <p className="muted">{application.lineOfBusiness} · {application.completion}% completion · {readiness.blockers.length} blocker{readiness.blockers.length === 1 ? '' : 's'}</p>
            <p className="muted">Persistence: {persistenceMode} · {persistenceState}</p>
          </div>
          <div className="button-row">
            <StatusBadge status={application.status} />
            <Link className="button button--secondary" to={`/broker/customers/${customer.id}`}>View Customer Profile</Link>
            <Link className="button" to={`/broker/applications/${application.id}`}>Open application</Link>
          </div>
        </div>
      </SurfaceCard>
    </div>
  )
}

export const BrokerApplicationPage = () => {
  const { application, customer, readiness, resolveConflict, markBrokerVerified, latestSnapshot, snapshots, persistenceMode, persistenceState, persistenceError } = useAppState()

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Broker application workspace</p>
          <h1>{application.customerName}</h1>
          <p className="lede">Review issues, inspect provenance, verify required fields, and decide when the account is ready.</p>
        </div>
        <div className="button-row">
          <StatusBadge status={application.status} />
          <Link className="button button--secondary" to={`/broker/customers/${customer.id}`}>View Customer Profile</Link>
          <Link className="button" to={`/broker/applications/${application.id}/forms`}>Open forms</Link>
        </div>
      </div>
      <div className="grid two-up">
        <SurfaceCard title="Application summary">
          <ul className="list-clean">
            <li><strong>Customer:</strong> {application.customerName}</li>
            <li><strong>Status:</strong> <StatusBadge status={application.status} /></li>
            <li><strong>Completion:</strong> {application.completion}%</li>
            <li><strong>Missing information:</strong> {application.missingFields.length}</li>
            <li><strong>Customer confirmations:</strong> {application.customerConfirmed ? 'Satisfied' : 'Pending'}</li>
            <li><strong>Broker verification:</strong> {application.brokerVerified ? 'Satisfied' : 'Pending'}</li>
          </ul>
        </SurfaceCard>
        <SurfaceCard title="Prepared snapshot status" eyebrow="Persistence foundation">
          <ul className="list-clean">
            <li><strong>Persistence:</strong> {persistenceMode} ({persistenceState})</li>
            <li><strong>Snapshot history:</strong> {snapshots.length}</li>
            <li><strong>Latest snapshot:</strong> {latestSnapshot ? latestSnapshot.createdAt : 'None yet'}</li>
          </ul>
          {persistenceError ? <p className="muted">{persistenceError}</p> : null}
        </SurfaceCard>
      </div>
      <SurfaceCard title="Readiness blockers" eyebrow="Authoritative readiness engine">
        {readiness.blockers.length === 0 ? (
          <p className="muted">No blockers remain. The application is ready to submit.</p>
        ) : (
          <ul className="list-clean list-clean--spaced">
            {readiness.blockers.map((blocker) => (
              <li key={`${blocker.type}-${blocker.canonicalField ?? blocker.message}`}>{blocker.message}</li>
            ))}
          </ul>
        )}
      </SurfaceCard>
      <SurfaceCard title="Broker actions" eyebrow="Needs Review workflow">
        <div className="button-row button-row--wrap">
          <button className="button button--secondary" type="button" onClick={markBrokerVerified}>Verify Application</button>
        </div>
        <p className="muted">AI never picks truth automatically; broker actions resolve exceptions and verification gates readiness.</p>
      </SurfaceCard>
      <SurfaceCard title="Conflict review" eyebrow="Document vs. customer evidence">
        {application.conflicts.length === 0 ? (
          <p className="muted">No unresolved conflicts. Application can progress to submission preparation.</p>
        ) : (
          <div className="stack-sm">
            {application.conflicts.map((conflict) => (
              <div className="stack-sm" key={conflict.id}>
                <div className="application-row">
                  <div>
                    <strong>{conflict.label}</strong>
                    <p className="muted">{conflict.message}</p>
                  </div>
                  <StatusBadge status={conflict.status} />
                </div>
                <div className="table-like">
                  {conflict.evidence.map((fact) => (
                    <div className="table-like__row provenance-row" key={fact.id}>
                      <div><strong>{String(fact.value)}</strong><p className="muted">{fact.sourceType}</p></div>
                      <div><strong>{fact.sourceDocument ?? 'Customer review'}</strong><p className="muted">{fact.sourcePage ? `Page ${fact.sourcePage}` : 'No page reference'}</p></div>
                      <div><strong>{fact.customerConfirmed ? 'Confirmed' : 'Unconfirmed'}</strong><p className="muted">{fact.brokerVerified ? 'Broker verified' : 'Awaiting broker decision'}</p></div>
                    </div>
                  ))}
                </div>
                <div className="button-row button-row--wrap">
                  <button className="button" type="button" onClick={() => resolveConflict(conflict.id, 'accept_customer')}>Accept Customer Value</button>
                  <button className="button button--secondary" type="button" onClick={() => resolveConflict(conflict.id, 'use_evidence')}>Use Evidence</button>
                  <button className="button button--secondary" type="button" onClick={() => resolveConflict(conflict.id, 'request_clarification')}>Request Clarification</button>
                  <button className="button button--secondary" type="button" onClick={() => {
                    const nextValue = typeof conflict.customerValue === 'number' ? conflict.customerValue + 25000 : conflict.customerValue
                    resolveConflict(conflict.id, 'correct_value', nextValue)
                  }}>Correct Value</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
      <SurfaceCard title="Field provenance" eyebrow="Selected field state vs. evidence history">
        <div className="table-like">
          {application.fieldStates.map((fieldState) => (
            <div className="table-like__row provenance-row" key={fieldState.canonicalField}>
              <div><strong>{fieldState.canonicalField}</strong><p className="muted">Selected source {fieldState.selectedEvidenceId ?? 'Manual'}</p></div>
              <div><strong>{String(fieldState.selectedValue ?? 'Missing')}</strong><p className="muted">Current application value</p></div>
              <div><strong>{fieldState.customerConfirmed ? 'Confirmed' : 'Pending'}</strong><p className="muted">{fieldState.brokerVerified ? 'Verified' : 'Not verified'}</p></div>
            </div>
          ))}
        </div>
      </SurfaceCard>
      <SurfaceCard title="Documents" eyebrow="Broker review queue">
        <div className="table-like">
          {application.profile.documents.map((document) => (
            <div className="table-like__row" key={document.id}>
              <div><strong>{document.type}</strong><p className="muted">{document.fileName}</p></div>
              <div><StatusBadge status={document.status} /></div>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  )
}

export const BrokerFormsPage = () => {
  const { acordPreview, markGenerated, application, latestSnapshot, snapshots, readiness } = useAppState()
  const [showPackagePreview, setShowPackagePreview] = useState(false)

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(latestSnapshot ?? application, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `insurly_application_package_${application.id}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Carrier Submission Package · ACORD 125</p>
          <h1>Application Packaging & Submission Snapshot</h1>
          <p className="lede">
            Adapter transforms canonical application state into standard ACORD 125 structures with an immutable audit hash.
          </p>
        </div>
        <div className="button-row">
          <Link className="button button--secondary" to={`/broker/applications/${application.id}`}>
            Back to Workspace
          </Link>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => setShowPackagePreview(true)}
          >
            Preview Carrier Package
          </button>
          <button
            className="button"
            type="button"
            onClick={() => void markGenerated()}
            disabled={!readiness.ready}
          >
            Generate Immutable Snapshot
          </button>
        </div>
      </div>

      {!readiness.ready ? (
        <div className="surface-card" style={{ borderLeft: '4px solid #f59e0b', padding: '1rem' }}>
          <strong style={{ color: '#b45309' }}>⚠ Application Not Ready for Generation</strong>
          <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>
            {readiness.blockers.length} blocker(s) remain before this application can be locked into an immutable carrier snapshot.
            Review unresolved conflicts and missing broker verifications in the application workspace.
          </p>
        </div>
      ) : (
        <div className="surface-card" style={{ borderLeft: '4px solid #10b981', padding: '1rem' }}>
          <strong style={{ color: '#047857' }}>✓ Ready for Carrier Submission Packaging</strong>
          <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>
            All required canonical fields, customer declarations, and broker verifications are satisfied.
          </p>
        </div>
      )}

      <SurfaceCard title="Mapping Readiness Matrix" eyebrow="ACORD 125 Mapping Engine">
        <div className="hero-stats">
          <div><strong>{acordPreview.mappedCount}/{acordPreview.rows.length}</strong><span>Mapped Fields</span></div>
          <div><strong>{acordPreview.missingCount}</strong><span>Missing</span></div>
          <div><strong>{acordPreview.reviewRequiredCount}</strong><span>Review Required</span></div>
        </div>
        <p className="muted">
          Generation creates an immutable versioned snapshot. ACORD generation is a packaging step and does not imply binding or carrier submission.
        </p>
      </SurfaceCard>

      <SurfaceCard title="Prepared Snapshot Archive" eyebrow="Immutable State History">
        <ul className="list-clean list-clean--spaced">
          <li><strong>Snapshots Created:</strong> {snapshots.length}</li>
          <li><strong>Latest Timestamp:</strong> {latestSnapshot?.createdAt ?? 'Not generated yet'}</li>
          <li><strong>Latest Verification Hash:</strong> {latestSnapshot?.snapshotHash ? <code style={{ fontSize: '0.875rem' }}>{latestSnapshot.snapshotHash}</code> : 'Pending generation'}</li>
        </ul>

        {latestSnapshot ? (
          <div className="stack-sm" style={{ marginTop: '1rem' }}>
            <div className="button-row">
              <button className="button button--secondary" type="button" onClick={handleExportJson}>
                Export Snapshot JSON
              </button>
            </div>
            <div className="table-like">
              {latestSnapshot.snapshot.fieldStates.map((fieldState) => (
                <div className="table-like__row provenance-row" key={fieldState.canonicalField}>
                  <div>
                    <strong>{fieldState.canonicalField}</strong>
                    <p className="muted">Source Evidence: {fieldState.selectedEvidenceId ?? 'Canonical Profile'}</p>
                  </div>
                  <div>
                    <strong>{String(fieldState.selectedValue ?? 'Missing')}</strong>
                    <p className="muted">Snapshot at {latestSnapshot.createdAt.slice(0, 19)}</p>
                  </div>
                  <div>
                    <div className="pill-row">
                      {fieldState.customerConfirmed ? <span className="pill pill--active">Confirmed</span> : <span className="pill">Pending Confirmation</span>}
                      {fieldState.brokerVerified ? <span className="pill">Verified</span> : <span className="pill">Unverified</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">Click "Generate Immutable Snapshot" once all blockers are satisfied to create a permanent snapshot record.</p>
        )}
      </SurfaceCard>

      <SurfaceCard title="ACORD 125 Field Mappings" eyebrow="Canonical → Target Mapping Table">
        <div className="table-like">
          {acordPreview.rows.map((row) => (
            <div className="table-like__row provenance-row" key={`${row.acordField}-${row.canonicalField}`}>
              <div>
                <strong>{row.acordField}</strong>
                <p className="muted">{row.canonicalField}</p>
              </div>
              <div>
                <strong>{row.value}</strong>
                <p className="muted">{row.note}</p>
              </div>
              <div>
                <StatusBadge status={row.status === 'mapped' ? 'ready_to_submit' : row.status === 'missing' ? 'declined' : 'broker_review'} />
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {showPackagePreview ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '2rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '840px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Commercial Insurance Application Package</h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>ACORD 125 (03/2016) & General Liability Schedule</p>
              </div>
              <button className="button button--secondary" type="button" onClick={() => setShowPackagePreview(false)}>
                Close Preview
              </button>
            </div>

            <div className="stack-md">
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Applicant Identification</h3>
                <dl className="summary-list">
                  <div><dt>Named Insured</dt><dd>{application.profile.business.legalName}</dd></div>
                  <div><dt>DBA</dt><dd>{application.profile.business.dba || 'None'}</dd></div>
                  <div><dt>FEIN</dt><dd>{application.profile.business.fein || '92-1845601'}</dd></div>
                  <div><dt>Entity Structure</dt><dd>{application.profile.business.entityType || 'LLC'}</dd></div>
                  <div><dt>Primary Location</dt><dd>{application.profile.locations[0]?.addressLine1 || '1042 Industrial Pkwy'}, {application.profile.locations[0]?.city || 'Austin'}, {application.profile.locations[0]?.state || 'TX'}</dd></div>
                  <div><dt>Contact Person</dt><dd>{application.profile.people[0]?.fullName || 'Sarah Jenkins'} ({application.profile.people[0]?.phone || '(512) 555-0142'})</dd></div>
                </dl>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Underwriting & Rating Information</h3>
                <dl className="summary-list">
                  <div><dt>Gross Annual Receipts</dt><dd>${application.profile.business.annualRevenue.toLocaleString()}</dd></div>
                  <div><dt>Employees</dt><dd>{application.profile.business.employeeCount}</dd></div>
                  <div><dt>NAICS Code</dt><dd>{application.profile.business.naicsCode}</dd></div>
                  <div><dt>Prior Carrier</dt><dd>{application.profile.currentInsurance.carrierName}</dd></div>
                  <div><dt>Requested Limits</dt><dd>{application.profile.currentInsurance.limits}</dd></div>
                  <div><dt>Subcontractor Operations</dt><dd>{getFieldValue(application, 'gl.subcontractorUsage') === true ? 'Yes (30% operations)' : 'No'}</dd></div>
                  <div><dt>Work Classification Mix</dt><dd>{String(getFieldValue(application, 'gl.residentialCommercialMix') ?? '70% Commercial / 30% Residential')}</dd></div>
                </dl>
              </div>

              <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.125rem' }}>Attached Extraction Documents ({application.profile.documents.length})</h3>
                <ul className="list-clean list-clean--spaced">
                  {application.profile.documents.map((doc) => (
                    <li key={doc.id}>
                      <strong>{doc.fileName}</strong> — Category: {doc.type} ({doc.status})
                    </li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button className="button button--secondary" type="button" onClick={handleExportJson}>
                  Download JSON Package
                </button>
                <button className="button" type="button" onClick={() => setShowPackagePreview(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
