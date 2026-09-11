import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ProgressBar } from '../../components/ProgressBar'
import { StatusBadge } from '../../components/StatusBadge'
import { SurfaceCard } from '../../components/SurfaceCard'
import { useAppState } from '../../state/useAppState'
import { getWizardQuestions } from '../../services/applicationEngine'
import { getApplicationDefinition } from '../../domain/applicationDefinitions'
import { getApplicableRequirements } from '../../services/application/requirementsEngine'
import { buildWizardPlan } from '../../services/wizard/wizardService'
import { getQuestionRenderer } from '../../services/wizard/questionRendererRegistry'
import { validateQuestionAnswer } from '../../services/wizard/wizardValidation'
import { getFieldValue } from '../../services/application/fieldAccess'
import type { DocumentCategory, DocumentRecord, FieldValue } from '../../domain/types'

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
  const { application, processDocuments, processDocumentWithAI, uploadDocument } = useAppState()
  const [processingDocId, setProcessingDocId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | ''>('')
  const [autoProcessOnUpload, setAutoProcessOnUpload] = useState(true)
  const [inspectedDoc, setInspectedDoc] = useState<DocumentRecord | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploadError(null)
    setIsUploading(true)

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const result = await uploadDocument(file, selectedCategory || undefined)
        if (!result.success) {
          setUploadError(result.error || `Failed to upload "${file.name}"`)
          break
        } else if (autoProcessOnUpload && result.document) {
          await handleProcessSingle(result.document.id)
        }
      }
    } catch (err: any) {
      setUploadError(err.message || 'An unexpected error occurred during upload')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileUpload(e.dataTransfer.files)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getDocFacts = (doc: DocumentRecord) => {
    return application.profile.fieldProvenance.filter(
      (p) => p.sourceDocument === doc.fileName || p.sourceDocument === doc.id || p.sourceDocument?.includes(doc.fileName),
    )
  }

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Document intelligence</p>
          <h2>Upload insurance documents & extract candidate evidence</h2>
          <p className="lede">
            Upload real PDF policies, ACORD applications, loss runs, or business filings. Insurly classifies documents, extracts normalized candidate facts with provenance, and populates application state without overwriting protected truth.
          </p>
        </div>
        <button className="button" type="button" onClick={handleProcessAll}>
          Process all documents
        </button>
      </div>

      <SurfaceCard title="Upload Real Insurance Document" eyebrow="Direct Ingestion">
        <div className="stack-md">
          <div className="split" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                Document Category Hint:
                <select
                  style={{ marginLeft: '0.5rem', padding: '0.4rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory | '')}
                >
                  <option value="">Auto-Detect Category</option>
                  <option value="current_policy">Current Policy (Dec Page / COI)</option>
                  <option value="prior_acord_application">Prior ACORD 125/126 Application</option>
                  <option value="loss_runs">Loss Runs Report</option>
                  <option value="vehicle_schedule">Commercial Auto Schedule</option>
                  <option value="business_document">Business Entity / Tax Document</option>
                </select>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={autoProcessOnUpload}
                  onChange={(e) => setAutoProcessOnUpload(e.target.checked)}
                />
                Auto-extract immediately on upload
              </label>
            </div>

            <span className="tag-badge tag-badge--model">
              ⚡ Server-side Multimodal AI Engine
            </span>
          </div>

          <div
            className={`dropzone ${isDragging ? 'dropzone--active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <div className="dropzone__icon">📄</div>
            <div>
              <strong>{isUploading ? 'Uploading and preparing document...' : 'Click or Drag & Drop Real Documents Here'}</strong>
              <p className="muted" style={{ marginTop: 4 }}>
                Supports PDF, PNG, JPEG, WEBP up to 20MB. Raw files are processed securely server-side.
              </p>
            </div>
          </div>

          {uploadError && (
            <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c' }}>
              <strong>Upload Error:</strong> {uploadError}
            </div>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard title="Document Intelligence Set" eyebrow="Classification & Processing">
        <div className="table-like">
          {application.profile.documents.map((document) => {
            const summary = document.extractionSummary
            const isProcessing =
              processingDocId === document.id ||
              document.status === 'processing' ||
              document.status === 'extracting' ||
              document.status === 'classifying'
            const isRealUpload = document.source === 'uploaded' || Boolean(document.storagePath)
            const docFacts = getDocFacts(document)

            return (
              <div className="table-like__row" key={document.id} style={{ alignItems: 'flex-start', padding: '14px 0' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <strong>{document.fileName}</strong>
                    {isRealUpload ? (
                      <span className="tag-badge tag-badge--real">Real Document Upload</span>
                    ) : (
                      <span className="tag-badge tag-badge--demo">Demo Fixture</span>
                    )}
                    {document.fileSize && (
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        ({formatFileSize(document.fileSize)})
                      </span>
                    )}
                  </div>
                  <p className="muted" style={{ marginTop: 4 }}>
                    Category: {document.category ?? document.type}{' '}
                    {summary ? `· ${Math.round(summary.classificationConfidence * 100)}% classification confidence` : ''}
                  </p>
                  {document.failureReason && (
                    <p className="text-sm" style={{ color: '#ef4444', marginTop: 4 }}>
                      Error: {document.failureReason}
                    </p>
                  )}
                  {summary && (
                    <div className="pill-row" style={{ marginTop: 8 }}>
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
                <div className="button-row" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <StatusBadge status={document.status} />
                  {docFacts.length > 0 && (
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => setInspectedDoc(document)}
                    >
                      Inspect Facts ({docFacts.length})
                    </button>
                  )}
                  {document.status === 'failed' ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleProcessSingle(document.id)}
                    >
                      {isProcessing ? 'Retrying...' : 'Retry Extraction'}
                    </button>
                  ) : (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleProcessSingle(document.id)}
                    >
                      {isProcessing ? 'Processing AI...' : 'Process with AI'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SurfaceCard>

      {inspectedDoc && (
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
              maxWidth: '800px',
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              padding: '2rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Candidate Facts: {inspectedDoc.fileName}</h3>
                <p className="muted" style={{ margin: '0.25rem 0 0 0' }}>
                  Category: {inspectedDoc.category ?? inspectedDoc.type} · {getDocFacts(inspectedDoc).length} extracted facts
                </p>
              </div>
              <button className="button button--secondary" type="button" onClick={() => setInspectedDoc(null)}>
                Close
              </button>
            </div>

            <div className="table-like">
              {getDocFacts(inspectedDoc).map((fact) => {
                const confPercent = Math.round((fact.confidence ?? 0.8) * 100)
                const confColor = confPercent >= 85 ? '#047857' : confPercent >= 60 ? '#b45309' : '#b91c1c'
                const confBg = confPercent >= 85 ? '#ecfdf5' : confPercent >= 60 ? '#fffbeb' : '#fef2f2'

                return (
                  <div className="table-like__row provenance-row" key={fact.id}>
                    <div>
                      <strong>{fact.label}</strong>
                      <p className="muted">{fact.canonicalField}</p>
                    </div>
                    <div>
                      <strong>{String(fact.value)}</strong>
                      <p className="muted">{fact.sourcePage ? `Page ${fact.sourcePage}` : 'Document extraction'}</p>
                    </div>
                    <div>
                      <span
                        className="pill"
                        style={{ backgroundColor: confBg, color: confColor, fontWeight: 600 }}
                      >
                        {confPercent}% confidence
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button className="button" type="button" onClick={() => setInspectedDoc(null)}>
                Done Inspecting
              </button>
            </div>
          </div>
        </div>
      )}

      <SurfaceCard title="Extracted Fact Provenance" eyebrow="Evidence History">
        <div className="table-like">
          {application.profile.fieldProvenance.length === 0 ? (
            <p className="muted">No document facts extracted yet. Upload a document or click "Process with AI" above to extract evidence.</p>
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
  const [validationError, setValidationError] = useState<string | null>(null)

  const inputValue = currentQuestion
    ? questionInputMap[currentQuestion.id] ?? currentQuestion.currentValue ?? ''
    : ''

  // Clear validation error when changing questions
  useEffect(() => {
    setValidationError(null)
  }, [currentQuestion?.id])

  const handleInputChange = (val: FieldValue) => {
    if (!currentQuestion) return
    setValidationError(null)
    setQuestionInputMap((prev) => ({ ...prev, [currentQuestion.id]: val }))
  }

  const handleSaveAndContinue = () => {
    if (!currentQuestion) return

    // Run per-question validation engine
    const validation = validateQuestionAnswer(currentQuestion, inputValue)
    if (!validation.valid) {
      setValidationError(validation.error || 'Please provide a valid answer before continuing.')
      return
    }

    let parsedValue: FieldValue = inputValue
    if (currentQuestion.inputType === 'number' || currentQuestion.inputType === 'currency') {
      parsedValue = Number(inputValue) || 0
    } else if (currentQuestion.inputType === 'boolean') {
      parsedValue = String(inputValue) === 'true' || inputValue === true
    }

    setValidationError(null)
    answerWizardQuestion(currentQuestion.canonicalField, parsedValue)
  }

  const handlePrevious = () => {
    if (activeQuestionIndex > 0) {
      setActiveQuestionIndex((prev) => prev - 1)
    }
  }

  // Keyboard navigation listener (Enter to submit, Alt+Left/Right to navigate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSaveAndContinue()
        }
        return
      }

      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevious()
      } else if (e.altKey && e.key === 'ArrowRight' && activeQuestionIndex < plan.unresolvedQuestions.length - 1) {
        e.preventDefault()
        setActiveQuestionIndex((prev) => prev + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentQuestion, inputValue, activeQuestionIndex, plan.unresolvedQuestions.length])

  // Get modular Question Renderer
  const RendererComponent = currentQuestion ? getQuestionRenderer(currentQuestion.inputType) : null

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
          <span className="pill">Keyboard: Enter to continue</span>
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
        {currentQuestion && RendererComponent ? (
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
              {currentQuestion.required && (
                <span className="pill" style={{ fontSize: '0.75rem', backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                  Required
                </span>
              )}
            </div>

            <div className="form-group" style={{ margin: '1rem 0' }}>
              <RendererComponent
                question={currentQuestion}
                value={inputValue}
                onChange={handleInputChange}
                onSubmit={handleSaveAndContinue}
                autoFocus={true}
              />
            </div>

            {validationError && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '0.375rem',
                  color: '#b91c1c',
                  fontSize: '0.875rem',
                }}
              >
                ⚠ {validationError}
              </div>
            )}

            <div className="button-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={handlePrevious}
                  disabled={activeQuestionIndex === 0}
                >
                  Previous
                </button>
                {activeQuestionIndex < plan.unresolvedQuestions.length - 1 && (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => setActiveQuestionIndex((prev) => prev + 1)}
                  >
                    Skip to Next
                  </button>
                )}
              </div>
              <button
                className="button"
                type="button"
                onClick={handleSaveAndContinue}
              >
                Save and continue ↵
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
