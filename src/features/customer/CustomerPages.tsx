import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ProgressBar } from '../../components/ProgressBar'
import { StatusBadge } from '../../components/StatusBadge'
import { SurfaceCard } from '../../components/SurfaceCard'
import { useAppState } from '../../state/useAppState'
import { getWizardQuestions } from '../../services/applicationEngine'
import { getApplicationDefinition } from '../../domain/applicationDefinitions'
import { getApplicableRequirements } from '../../services/application/requirementsEngine'
import { buildWizardPlan } from '../../services/wizard/wizardService'
import { getFieldValue } from '../../services/application/fieldAccess'
import type { FieldValue } from '../../domain/types'

const sectionMap: Record<string, { title: string; summary: string }> = {
  overview: {
    title: 'Overview',
    summary: 'Monitor readiness, missing information, and the next best customer action.',
  },
  'business-information': {
    title: 'Business Information',
    summary: 'Legal entity, operations, revenue, and industry classification.',
  },
  people: {
    title: 'People',
    summary: 'Primary contacts, owners, and decision makers.',
  },
  locations: {
    title: 'Locations',
    summary: 'Primary operating locations and occupancy details.',
  },
  'vehicles-equipment': {
    title: 'Vehicles/Equipment',
    summary: 'Scheduled autos and rented equipment exposures.',
  },
  'current-insurance': {
    title: 'Current Insurance',
    summary: 'Current carrier, limits, and renewal timing.',
  },
  'loss-history': {
    title: 'Loss History',
    summary: 'Prior incidents and claim trends.',
  },
}

export const CustomerOverviewPage = () => {
  const { application, readiness } = useAppState()
  const location = useLocation()
  const slug = location.pathname.split('/').at(-1) ?? 'overview'
  const section = sectionMap[slug]
  const wizardQuestions = getWizardQuestions(application)
  const definition = getApplicationDefinition(application.definitionId, application.definitionVersion)
  const totalRequiredFields = getApplicableRequirements(application, definition).filter((item) => item.requirement.required).length

  if (slug !== 'overview' && section) {
    return (
      <div className="stack-lg">
        <div className="page-header">
          <div>
            <p className="eyebrow">{section.title}</p>
            <h2>{section.summary}</h2>
          </div>
          <Link className="button button--secondary" to={`/customer/applications/${application.id}/wizard`}>
            Continue smart wizard
          </Link>
        </div>
        <SurfaceCard title={section.title}>
          <dl className="info-grid">
            <div><dt>Known required fields</dt><dd>{totalRequiredFields - application.missingFields.length}</dd></div>
            <div><dt>Missing fields</dt><dd>{application.missingFields.length}</dd></div>
            <div><dt>Pending questions</dt><dd>{wizardQuestions.length}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge status={application.status} /></dd></div>
          </dl>
          <p className="muted">Insurly uses progressive disclosure so customers never see a long, overwhelming questionnaire.</p>
        </SurfaceCard>
      </div>
    )
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Application overview</p>
          <h2>{application.customerName} · {application.lineOfBusiness}</h2>
          <p className="lede">The customer can move between document intake, wizard completion, and review without re-entering known information.</p>
        </div>
        <Link className="button" to={`/customer/applications/${application.id}/documents`}>
          Continue intake
        </Link>
      </div>

      <SurfaceCard title="Readiness summary" actions={<StatusBadge status={application.status} />}>
        <div className="hero-stats">
          <div>
            <strong>{application.completion}%</strong>
            <span>completion</span>
          </div>
          <div>
            <strong>{application.missingFields.length}</strong>
            <span>missing items</span>
          </div>
          <div>
            <strong>{readiness.blockers.length}</strong>
            <span>readiness blockers</span>
          </div>
        </div>
        <ProgressBar value={application.completion} />
      </SurfaceCard>

      <div className="grid two-up">
        <SurfaceCard title="Canonical profile snapshot" eyebrow="Unified customer record">
          <ul className="list-clean">
            <li><strong>Legal name:</strong> {application.profile.business.legalName}</li>
            <li><strong>Revenue:</strong> ${application.profile.business.annualRevenue.toLocaleString()}</li>
            <li><strong>Employees:</strong> {application.profile.business.employeeCount}</li>
            <li><strong>NAICS:</strong> {application.profile.business.naicsCode}</li>
            <li><strong>Primary location:</strong> {application.profile.locations[0]?.city}, {application.profile.locations[0]?.state}</li>
          </ul>
        </SurfaceCard>
        <SurfaceCard title="Next actions" eyebrow="Customer workflow">
          <ul className="list-clean list-clean--spaced">
            <li>Upload and process the current policy to extract known fields automatically.</li>
            <li>Use the smart wizard for only the {wizardQuestions.length} unresolved required questions.</li>
            <li>Review material declarations before the broker verifies the application.</li>
          </ul>
          <div className="button-row">
            <Link className="button button--secondary" to={`/customer/applications/${application.id}/documents`}>Upload documents</Link>
            <Link className="button button--secondary" to={`/customer/applications/${application.id}/wizard`}>Open wizard</Link>
            <Link className="button button--secondary" to={`/customer/applications/${application.id}/review`}>Review summary</Link>
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}

export const DocumentIntakePage = () => {
  const { application, processDocuments, processDocumentWithAI } = useAppState()
  const [processingDocId, setProcessingDocId] = useState<string | null>(null)

  const handleProcessSingle = async (docId: string) => {
    setProcessingDocId(docId)
    try {
      await processDocumentWithAI(docId)
    } finally {
      setProcessingDocId(null)
    }
  }

  const handleProcessAll = async () => {
    await processDocuments()
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Document intelligence</p>
          <h2>Upload insurance documents & extract candidate evidence</h2>
          <p className="lede">
            Insurly classifies documents, extracts normalized candidate facts with provenance, and pre-populates application state without overwriting customer-verified truth.
          </p>
        </div>
        <button className="button" type="button" onClick={handleProcessAll}>
          Process all documents
        </button>
      </div>

      <SurfaceCard title="Uploaded Document Intelligence Set" eyebrow="Classification & Processing">
        <div className="table-like">
          {application.profile.documents.map((document) => {
            const summary = document.extractionSummary
            const isProcessing = processingDocId === document.id || document.status === 'processing' || document.status === 'extracting' || document.status === 'classifying'

            return (
              <div className="table-like__row" key={document.id} style={{ alignItems: 'flex-start', padding: '12px 0' }}>
                <div style={{ flex: 1 }}>
                  <strong>{document.fileName}</strong>
                  <p className="muted">
                    Category: {document.category ?? document.type} {summary ? `· ${Math.round(summary.classificationConfidence * 100)}% match` : ''}
                  </p>
                  {document.failureReason && (
                    <p className="text-sm" style={{ color: '#ef4444', marginTop: 4 }}>
                      Error: {document.failureReason}
                    </p>
                  )}
                  {summary && (
                    <div className="pill-row" style={{ marginTop: 6 }}>
                      <span className="pill">{summary.totalFactsFound} facts found</span>
                      <span className="pill" style={{ backgroundColor: '#ecfdf5', color: '#047857' }}>
                        {summary.acceptedFactsCount} accepted
                      </span>
                      {summary.reviewRequiredCount > 0 && (
                        <span className="pill" style={{ backgroundColor: '#fffbebe', color: '#b45309' }}>
                          {summary.reviewRequiredCount} review required
                        </span>
                      )}
                      {summary.conflictsCreatedCount > 0 && (
                        <span className="pill" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                          {summary.conflictsCreatedCount} conflicts created
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="button-row" style={{ alignItems: 'center' }}>
                  <StatusBadge status={document.status} />
                  <button
                    className="button button--secondary"
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleProcessSingle(document.id)}
                  >
                    {isProcessing ? 'Processing...' : 'Process with AI'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </SurfaceCard>

      <SurfaceCard title="Extracted Fact Provenance" eyebrow="Evidence History">
        <div className="table-like">
          {application.profile.fieldProvenance.length === 0 ? (
            <p className="muted">No document facts extracted yet. Click "Process with AI" above to extract evidence.</p>
          ) : (
            application.profile.fieldProvenance.map((fact) => (
              <div className="table-like__row provenance-row" key={fact.id}>
                <div>
                  <strong>{fact.label}</strong>
                  <p className="muted">{fact.canonicalField}</p>
                </div>
                <div>
                  <strong>{String(fact.value)}</strong>
                  <p className="muted">
                    {fact.sourceType} · {fact.sourceDocument ?? 'No document'}
                    {fact.sourcePage ? ` · p.${fact.sourcePage}` : ''}
                  </p>
                </div>
                <div>
                  <strong>{fact.confidence ? `${Math.round(fact.confidence * 100)}%` : '—'}</strong>
                  <p className="muted">{fact.customerConfirmed ? 'Customer confirmed' : 'Evidence only'}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>

      <div className="button-row button-row--wrap" style={{ justifyContent: 'space-between' }}>
        <p className="muted">
          Extracted facts populate missing application requirements. Smart Wizard will ask only what is still unresolved.
        </p>
        <Link className="button" to={`/customer/applications/${application.id}/wizard`}>
          Continue to Smart Wizard
        </Link>
      </div>
    </div>
  )
}

export const SmartWizardPage = () => {
  const { application, answerWizardQuestion } = useAppState()
  const plan = buildWizardPlan(application)

  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0)
  const currentQuestion = plan.unresolvedQuestions[activeQuestionIndex] ?? plan.unresolvedQuestions[0]

  const [questionInputMap, setQuestionInputMap] = useState<Record<string, FieldValue>>({})
  const inputValue = currentQuestion
    ? questionInputMap[currentQuestion.id] ?? currentQuestion.currentValue ?? ''
    : ''

  const handleInputChange = (val: FieldValue) => {
    if (!currentQuestion) return
    setQuestionInputMap((prev) => ({ ...prev, [currentQuestion.id]: val }))
  }

  const handleSaveAndContinue = () => {
    if (!currentQuestion) return

    let parsedValue: FieldValue = inputValue
    if (currentQuestion.inputType === 'number' || currentQuestion.inputType === 'currency') {
      parsedValue = Number(inputValue) || 0
    } else if (currentQuestion.inputType === 'boolean') {
      parsedValue = String(inputValue) === 'true' || inputValue === true
    }

    answerWizardQuestion(currentQuestion.canonicalField, parsedValue)
  }

  const handlePrevious = () => {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex((prev) => prev - 1)
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Smart wizard</p>
          <h2>Only ask what is still unresolved</h2>
          <p className="lede">
            Missing fields, question order, and completion are dynamically derived from the application definition.
          </p>
        </div>
        <div className="pill-row">
          <span className="pill">Skip known fields</span>
          <span className="pill">Save & resume</span>
          <span className="pill">Deterministic logic</span>
        </div>
      </div>

      <div className="card-grid">
        <SurfaceCard
          title="Application Progress"
          eyebrow={`${plan.completedQuestionsCount} of ${plan.totalApplicableQuestions} completed`}
        >
          <div className="stack-sm">
            <ProgressBar value={plan.progressPercentage} />
            <p className="muted text-sm">{plan.progressPercentage}% complete</p>
          </div>
        </SurfaceCard>

        <SurfaceCard
          title="Sections Summary"
          eyebrow={`${plan.sections.filter((s) => s.isComplete).length} of ${plan.sections.length} sections complete`}
        >
          <div className="pill-row">
            {plan.sections.map((sec) => (
              <span
                key={sec.section}
                className={`pill ${sec.isComplete ? 'pill--success' : ''}`}
                style={{
                  backgroundColor: sec.isComplete ? 'var(--color-success-tint, #eefdf2)' : undefined,
                  color: sec.isComplete ? 'var(--color-success, #16a34a)' : undefined,
                }}
              >
                {sec.section}: {sec.resolvedCount}/{sec.totalCount}
              </span>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard
        title="Question renderer"
        eyebrow={
          plan.unresolvedQuestions.length > 0
            ? `${plan.unresolvedQuestions.length} unresolved question${plan.unresolvedQuestions.length === 1 ? '' : 's'} remaining`
            : 'Complete'
        }
      >
        {currentQuestion ? (
          <div className="wizard-card stack-md">
            <div className="split">
              <span>
                Question {activeQuestionIndex + 1} of {plan.unresolvedQuestions.length}
              </span>
              <span className="pill">{currentQuestion.section}</span>
            </div>

            <div>
              <h3>{currentQuestion.label}</h3>
              {currentQuestion.helperText && (
                <p className="muted" style={{ marginTop: '0.25rem' }}>
                  {currentQuestion.helperText}
                </p>
              )}
            </div>

            <div className="pill-row" style={{ marginTop: '0.5rem' }}>
              <span
                className="pill"
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: currentQuestion.profileReusable ? '#eef4ff' : '#f3f4f6',
                  color: currentQuestion.profileReusable ? '#1f6fff' : '#4b5563',
                }}
              >
                {currentQuestion.profileReusable
                  ? '✓ Updates reusable customer profile'
                  : 'ℹ Application-only fact (policy specific)'}
              </span>
            </div>

            <div className="form-group" style={{ margin: '1rem 0' }}>
              {currentQuestion.inputType === 'select' || currentQuestion.options ? (
                <select
                  className="input"
                  value={String(inputValue)}
                  onChange={(e) => handleInputChange(e.target.value)}
                >
                  <option value="">Select an option...</option>
                  {currentQuestion.options?.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : currentQuestion.inputType === 'boolean' ? (
                <select
                  className="input"
                  value={String(inputValue)}
                  onChange={(e) => handleInputChange(e.target.value === 'true')}
                >
                  <option value="">Select...</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : currentQuestion.inputType === 'date' ? (
                <input
                  type="date"
                  className="input"
                  value={String(inputValue)}
                  onChange={(e) => handleInputChange(e.target.value)}
                />
              ) : currentQuestion.inputType === 'number' || currentQuestion.inputType === 'currency' ? (
                <div style={{ position: 'relative' }}>
                  {currentQuestion.inputType === 'currency' && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '0.75rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#6b7280',
                      }}
                    >
                      $
                    </span>
                  )}
                  <input
                    type="number"
                    className="input"
                    style={{ paddingLeft: currentQuestion.inputType === 'currency' ? '2rem' : undefined }}
                    placeholder={currentQuestion.placeholder ?? '0'}
                    value={String(inputValue)}
                    onChange={(e) => handleInputChange(e.target.value)}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  className="input"
                  placeholder={currentQuestion.placeholder ?? 'Enter value...'}
                  value={String(inputValue)}
                  onChange={(e) => handleInputChange(e.target.value)}
                />
              )}
            </div>

            <div className="button-row">
              <button
                className="button button--secondary"
                type="button"
                onClick={handlePrevious}
                disabled={activeQuestionIndex === 0}
              >
                Previous
              </button>
              <button
                className="button"
                type="button"
                onClick={handleSaveAndContinue}
                disabled={inputValue === '' || inputValue === undefined}
              >
                Save and continue
              </button>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <h3>All missing information collected</h3>
            <p className="muted">
              All required fields for this commercial application have been collected. You can now review and confirm the material information.
            </p>
            <Link className="button" to={`/customer/applications/${application.id}/review`}>
              Continue to customer review
            </Link>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}

export const CustomerReviewPage = () => {
  const { application, customer, confirmCustomerReview, confirmRevenueChange } = useAppState()

  const isComplete = application.customerConfirmed

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Customer Intake · Review & Confirmation</p>
          <h2>{isComplete ? 'Intake Complete · Transmitted to Broker' : 'Review & Confirm Application Details'}</h2>
          <p className="lede">
            {isComplete
              ? 'Your commercial general liability details have been confirmed and transmitted to your broker for verification and carrier submission.'
              : 'Please review the information compiled from your documents and questionnaire. Confirm the declarations below to proceed.'}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      {isComplete ? (
        <SurfaceCard title="Application Intake Transmitted" eyebrow="Status: Broker Review">
          <div className="stack-md" style={{ padding: '0.5rem 0' }}>
            <div
              style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #10b981',
                borderRadius: '8px',
                padding: '1.25rem',
                color: '#065f46',
              }}
            >
              <h3 style={{ margin: 0, color: '#047857' }}>✓ Application Received by Broker</h3>
              <p style={{ marginTop: '0.5rem', marginBottom: 0, lineHeight: 1.6 }}>
                Your broker has received all declarations for <strong>{application.customerName}</strong> ({application.lineOfBusiness}).
                Your broker will verify the details, resolve any policy notes, and prepare the formal submission package for insurer rating.
              </p>
              <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.875rem', opacity: 0.9 }}>
                <em>Note: This is an application intake receipt, not an active insurance policy or carrier binder.</em>
              </p>
            </div>

            <div className="button-row">
              <Link className="button button--secondary" to={`/customer/applications/${application.id}/overview`}>
                View Application Overview
              </Link>
              <Link className="button" to="/broker/dashboard">
                Open Broker Portal
              </Link>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="grid two-up">
        <SurfaceCard title="Business Identity" eyebrow="Section 1">
          <dl className="summary-list">
            <div><dt>Legal Name</dt><dd>{application.profile.business.legalName}</dd></div>
            <div><dt>DBA / Operating Name</dt><dd>{application.profile.business.dba || 'None'}</dd></div>
            <div><dt>Entity Type</dt><dd>{application.profile.business.entityType || 'LLC'}</dd></div>
            <div><dt>State of Formation</dt><dd>{application.profile.business.stateOfFormation || 'Texas'}</dd></div>
            <div><dt>FEIN</dt><dd>{application.profile.business.fein || '92-1845601'}</dd></div>
            <div><dt>Gross Revenue</dt><dd>${application.profile.business.annualRevenue.toLocaleString()}</dd></div>
            <div><dt>Headcount</dt><dd>{application.profile.business.employeeCount} employees</dd></div>
            <div><dt>NAICS Code</dt><dd>{application.profile.business.naicsCode}</dd></div>
          </dl>
        </SurfaceCard>

        <SurfaceCard title="Contact & Premises" eyebrow="Section 2">
          <dl className="summary-list">
            <div><dt>Authorized Contact</dt><dd>{application.profile.people[0]?.fullName || customer.displayName}</dd></div>
            <div><dt>Contact Email</dt><dd>{application.profile.people[0]?.email || customer.email}</dd></div>
            <div><dt>Operating Address</dt><dd>{application.profile.locations[0]?.addressLine1 || '1042 Industrial Pkwy'}</dd></div>
            <div><dt>City, State, Zip</dt><dd>{application.profile.locations[0]?.city || 'Austin'}, {application.profile.locations[0]?.state || 'TX'} {application.profile.locations[0]?.postalCode || '78758'}</dd></div>
            <div><dt>Occupancy</dt><dd>{application.profile.locations[0]?.occupancy || 'Commercial facility'}</dd></div>
          </dl>
        </SurfaceCard>
      </div>

      <div className="grid two-up">
        <SurfaceCard title="Insurance Coverage & Dates" eyebrow="Section 3">
          <dl className="summary-list">
            <div><dt>Current Carrier</dt><dd>{application.profile.currentInsurance.carrierName}</dd></div>
            <div><dt>Current Limits</dt><dd>{application.profile.currentInsurance.limits}</dd></div>
            <div><dt>Expiration Date</dt><dd>{application.profile.currentInsurance.expirationDate}</dd></div>
            <div><dt>Desired Effective Date</dt><dd>{application.profile.currentInsurance.effectiveDate || '2026-01-01'}</dd></div>
          </dl>
        </SurfaceCard>

        <SurfaceCard title="General Liability Exposures & Loss" eyebrow="Sections 4 & 5">
          <dl className="summary-list">
            <div>
              <dt>Subcontractor Usage</dt>
              <dd>{getFieldValue(application, 'gl.subcontractorUsage') === true ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Subcontractor %</dt>
              <dd>{String(getFieldValue(application, 'gl.subcontractorPercent') ?? '0%')}</dd>
            </div>
            <div>
              <dt>Work Mix</dt>
              <dd>{String(getFieldValue(application, 'gl.residentialCommercialMix') ?? '70% Commercial, 30% Residential')}</dd>
            </div>
            <div>
              <dt>Prior Losses</dt>
              <dd>{application.profile.lossHistory[0]?.description || 'No losses recorded'}</dd>
            </div>
          </dl>
        </SurfaceCard>
      </div>

      {!isComplete ? (
        <SurfaceCard title="Confirm Declarations" eyebrow="Customer Sign-off">
          <p className="muted">
            By clicking "Confirm All Declarations", you certify that the statements provided above are complete and accurate to the best of your knowledge.
          </p>
          <div className="button-row button-row--wrap" style={{ marginTop: '1rem' }}>
            <button className="button" type="button" onClick={confirmCustomerReview}>
              Confirm All Declarations & Transmit to Broker
            </button>
            <button className="button button--secondary" type="button" onClick={confirmRevenueChange}>
              Simulate Customer Revenue Discrepancy ($150,000)
            </button>
            <Link className="button button--secondary" to="/broker/dashboard">
              Open Broker Portal
            </Link>
          </div>
        </SurfaceCard>
      ) : null}

      {application.conflicts.length > 0 ? (
        <SurfaceCard title="Data Discrepancy Detected" eyebrow="Requires Broker Resolution">
          <p style={{ color: '#b91c1c', fontWeight: 600 }}>{application.conflicts[0]?.message}</p>
          <div className="table-like">
            {application.conflicts[0]?.evidence.map((fact) => (
              <div className="table-like__row" key={fact.id}>
                <div>
                  <strong>Source: {fact.sourceType}</strong>
                  <p className="muted">{fact.sourceDocument ?? 'Customer Input'}</p>
                </div>
                <div>
                  <strong>Value: {String(fact.value)}</strong>
                  <p className="muted">Recorded: {fact.timestamp.slice(0, 10)}</p>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  )
}
