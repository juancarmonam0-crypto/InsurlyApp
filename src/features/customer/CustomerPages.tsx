import { Link, useLocation } from 'react-router-dom'
import { ProgressBar } from '../../components/ProgressBar'
import { StatusBadge } from '../../components/StatusBadge'
import { SurfaceCard } from '../../components/SurfaceCard'
import { useAppState } from '../../state/useAppState'
import { getWizardQuestions } from '../../services/applicationEngine'
import { getApplicationDefinition } from '../../domain/applicationDefinitions'
import { getApplicableRequirements } from '../../services/application/requirementsEngine'

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
          <Link className="button button--secondary" to="/customer/applications/nexo/wizard">
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
        <Link className="button" to="/customer/applications/nexo/documents">
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
            <Link className="button button--secondary" to="/customer/applications/nexo/documents">Upload documents</Link>
            <Link className="button button--secondary" to="/customer/applications/nexo/wizard">Open wizard</Link>
            <Link className="button button--secondary" to="/customer/applications/nexo/review">Review summary</Link>
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}

export const DocumentIntakePage = () => {
  const { application, processDocuments } = useAppState()

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Document intake</p>
          <h2>Upload documents and let Insurly prefill the canonical profile</h2>
          <p className="lede">Simulated states move from Uploading → Processing → Extracting → Review Required/Complete.</p>
        </div>
        <button className="button" type="button" onClick={processDocuments}>Process uploaded documents</button>
      </div>
      <SurfaceCard title="Requested document set">
        <div className="table-like">
          {application.profile.documents.map((document) => (
            <div className="table-like__row" key={document.id}>
              <div>
                <strong>{document.type}</strong>
                <p className="muted">{document.fileName}</p>
              </div>
              <StatusBadge status={document.status} />
            </div>
          ))}
        </div>
      </SurfaceCard>
      <SurfaceCard title="Extracted facts" eyebrow="Field provenance">
        <div className="table-like">
          {application.profile.fieldProvenance.map((fact) => (
            <div className="table-like__row provenance-row" key={fact.id}>
              <div>
                <strong>{fact.label}</strong>
                <p className="muted">{fact.canonicalField}</p>
              </div>
              <div>
                <strong>{String(fact.value)}</strong>
                <p className="muted">{fact.sourceType} · {fact.sourceDocument ?? 'No document'}{fact.sourcePage ? ` · p.${fact.sourcePage}` : ''}</p>
              </div>
              <div>
                <strong>{fact.confidence ? `${Math.round(fact.confidence * 100)}%` : '—'}</strong>
                <p className="muted">{fact.customerConfirmed ? 'Customer confirmed' : 'Awaiting confirmation'}</p>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>
      <Link className="button button--secondary" to="/customer/applications/nexo/wizard">Continue to smart wizard</Link>
    </div>
  )
}

export const SmartWizardPage = () => {
  const { application, answerWizardQuestion } = useAppState()
  const questions = getWizardQuestions(application)
  const current = questions[0]

  const handleAnswer = () => {
    if (!current) return

    if (current.canonicalField === 'business.yearsInBusiness') {
      answerWizardQuestion(current.canonicalField, 6)
      return
    }

    if (current.canonicalField === 'business.fein') {
      answerWizardQuestion(current.canonicalField, '92-1845601')
      return
    }

    if (current.canonicalField === 'currentInsurance.effectiveDate') {
      answerWizardQuestion(current.canonicalField, '2027-01-01')
    }
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Smart wizard</p>
          <h2>Only ask what is still unresolved</h2>
          <p className="lede">The requirement definition drives missing fields, question order, and completion from one metadata source.</p>
        </div>
        <div className="pill-row">
          <span className="pill">Skip known fields</span>
          <span className="pill">Save & resume</span>
          <span className="pill">Deterministic logic</span>
        </div>
      </div>

      <SurfaceCard title="Question renderer" eyebrow={current ? `${questions.length} question${questions.length === 1 ? '' : 's'} remaining` : 'Complete'}>
        {current ? (
          <div className="wizard-card">
            <div className="split"><span>Step {1} of {questions.length}</span><span>{current.section}</span></div>
            <ProgressBar value={application.completion} />
            <h3>{current.label}</h3>
            <p className="muted">{current.helperText}</p>
            <div className="mock-input">Type: {current.type}</div>
            <div className="button-row">
              <button className="button button--secondary" type="button">Previous</button>
              <button className="button" type="button" onClick={handleAnswer}>Save and continue</button>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <h3>All missing information collected</h3>
            <p className="muted">The application now routes the customer into a concise review and confirmation step.</p>
            <Link className="button" to="/customer/applications/nexo/review">Continue to customer review</Link>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}

export const CustomerReviewPage = () => {
  const { application, confirmCustomerReview, confirmRevenueChange } = useAppState()

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Customer review</p>
          <h2>Confirm the material information before broker review</h2>
          <p className="lede">This demo intentionally changes revenue from $300,000 to $150,000 so the original document evidence stays preserved and a conflict is created.</p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <SurfaceCard title="Summary to confirm">
        <dl className="summary-list">
          <div><dt>Legal name</dt><dd>{application.profile.business.legalName}</dd></div>
          <div><dt>Annual revenue</dt><dd>${application.profile.business.annualRevenue.toLocaleString()}</dd></div>
          <div><dt>Employees</dt><dd>{application.profile.business.employeeCount}</dd></div>
          <div><dt>Current carrier</dt><dd>{application.profile.currentInsurance.carrierName}</dd></div>
          <div><dt>Primary contact</dt><dd>{application.profile.people[0]?.fullName}</dd></div>
        </dl>
        <div className="button-row">
          <button className="button button--secondary" type="button" onClick={confirmCustomerReview}>Confirm information</button>
          <button className="button" type="button" onClick={confirmRevenueChange}>Edit revenue to $150,000</button>
          <Link className="button button--secondary" to="/broker/dashboard">Open broker portal</Link>
        </div>
      </SurfaceCard>
      {application.conflicts.length > 0 ? (
        <SurfaceCard title="Conflict detected" eyebrow="Needs broker review">
          <p>{application.conflicts[0]?.message}</p>
          <div className="table-like">
            {application.conflicts[0]?.evidence.map((fact) => (
              <div className="table-like__row" key={fact.id}>
                <div><strong>{fact.sourceType}</strong><p className="muted">{fact.sourceDocument ?? 'Customer review'}</p></div>
                <div><strong>{String(fact.value)}</strong><p className="muted">{fact.timestamp.slice(0, 10)}</p></div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  )
}
