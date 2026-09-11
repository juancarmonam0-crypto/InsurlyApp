import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ProgressBar } from '../../components/ProgressBar'
import { StatusBadge } from '../../components/StatusBadge'
import { SurfaceCard } from '../../components/SurfaceCard'
import { useAppState } from '../../state/useAppState'
import { buildWizardPlan } from '../../services/wizard/wizardService'
import { getQuestionRenderer } from '../../services/wizard/questionRendererRegistry'
import { validateQuestionAnswer } from '../../services/wizard/wizardValidation'
import { getFieldValue } from '../../services/application/fieldAccess'
import type { DocumentCategory, DocumentRecord, FieldValue } from '../../domain/types'

const documentLabels: Record<string, string> = {
  current_policy: 'Current policy',
  prior_acord_application: 'Prior application',
  loss_runs: 'Loss runs',
  vehicle_schedule: 'Vehicle schedule',
  business_document: 'Business document',
  'Current Policy': 'Current policy',
  'Previous ACORD App': 'Prior application',
  'Loss Runs': 'Loss runs',
  'Business Docs': 'Business document',
  'Vehicle Schedule': 'Vehicle schedule',
}

const getDocumentLabel = (document: DocumentRecord) => documentLabels[document.category ?? document.type] ?? document.type

const formatFileSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const CustomerOverviewPage = () => {
  const { application } = useAppState()

  return <Navigate to={`/customer/applications/${application.id}/documents`} replace />
}

export const DocumentIntakePage = () => {
  const { application, processDocumentWithAI, uploadDocument } = useAppState()
  const [processingDocId, setProcessingDocId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | ''>('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleProcessSingle = async (docId: string) => {
    setProcessingDocId(docId)
    try {
      await processDocumentWithAI(docId)
    } finally {
      setProcessingDocId(null)
    }
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
        }

        if (result.document) {
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

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Documents</p>
          <h2>Upload anything that helps with your application</h2>
          <p className="lede">
            Current policies, prior applications, loss runs, or business documents can save time. You can also skip this step and answer questions manually.
          </p>
        </div>
        <div className="button-row">
          <Link className="button button--secondary" to={`/customer/applications/${application.id}/wizard`}>
            Skip for now
          </Link>
        </div>
      </div>

      <SurfaceCard title="Add documents" eyebrow="Optional">
        <div className="stack-md">
          <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>
            Document type (optional)
            <select
              className="input"
              style={{ marginTop: '0.5rem' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory | '')}
            >
              <option value="">Choose a type if you know it</option>
              <option value="current_policy">Current policy</option>
              <option value="prior_acord_application">Prior application</option>
              <option value="loss_runs">Loss runs</option>
              <option value="vehicle_schedule">Vehicle schedule</option>
              <option value="business_document">Business document</option>
            </select>
          </label>

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
              <strong>{isUploading ? 'Uploading your document...' : 'Click or drag documents here'}</strong>
              <p className="muted" style={{ marginTop: 4 }}>
                PDF, PNG, JPEG, and WEBP files are supported.
              </p>
            </div>
          </div>

          {uploadError ? (
            <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: '#b91c1c' }}>
              <strong>Upload error:</strong> {uploadError}
            </div>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard title="Uploaded documents" eyebrow={`${application.profile.documents.length} item${application.profile.documents.length === 1 ? '' : 's'}`}>
        <div className="table-like">
          {application.profile.documents.map((document) => {
            const isProcessing =
              processingDocId === document.id ||
              document.status === 'processing' ||
              document.status === 'extracting' ||
              document.status === 'classifying'

            return (
              <div className="table-like__row" key={document.id} style={{ alignItems: 'flex-start' }}>
                <div className="stack-sm">
                  <div className="cluster">
                    <strong>{document.fileName}</strong>
                    <StatusBadge status={document.status} />
                  </div>
                  <p className="muted">
                    {getDocumentLabel(document)}
                    {document.fileSize ? ` · ${formatFileSize(document.fileSize)}` : ''}
                  </p>
                </div>
                <div className="button-row" style={{ alignItems: 'center' }}>
                  {document.status === 'failed' || document.status === 'uploaded' || document.status === 'uploading' ? (
                    <button
                      className="button button--secondary"
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleProcessSingle(document.id)}
                    >
                      {isProcessing ? 'Processing...' : document.status === 'failed' ? 'Try again' : 'Use this document'}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </SurfaceCard>

      <div className="button-row button-row--wrap" style={{ justifyContent: 'space-between' }}>
        <p className="muted">We will use what we can from your documents and ask only for anything still missing.</p>
        <Link className="button" to={`/customer/applications/${application.id}/wizard`}>
          Continue to smart questions
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

  const handleInputChange = (val: FieldValue) => {
    if (!currentQuestion) return
    setValidationError(null)
    setQuestionInputMap((prev) => ({ ...prev, [currentQuestion.id]: val }))
  }

  const handleSaveAndContinue = () => {
    if (!currentQuestion) return

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
      setValidationError(null)
      setActiveQuestionIndex((prev) => prev - 1)
    }
  }

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
  }, [activeQuestionIndex, currentQuestion, handlePrevious, handleSaveAndContinue, inputValue, plan.unresolvedQuestions.length])

  const RendererComponent = currentQuestion ? getQuestionRenderer(currentQuestion.inputType) : null
  const remainingQuestions = plan.unresolvedQuestions.length

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Smart questions</p>
          <h2>Answer only what we still need</h2>
          <p className="lede">We skipped anything we could already fill from your documents or saved information.</p>
        </div>
        <Link className="button button--secondary" to={`/customer/applications/${application.id}/review`}>
          Go to review
        </Link>
      </div>

      <div className="card-grid">
        <SurfaceCard title="Application progress" eyebrow={`${plan.completedQuestionsCount} answered`}>
          <div className="stack-sm">
            <ProgressBar value={plan.progressPercentage} />
            <p className="muted text-sm">{plan.progressPercentage}% complete</p>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Still needed" eyebrow={`${remainingQuestions} question${remainingQuestions === 1 ? '' : 's'} left`}>
          <div className="pill-row">
            {plan.sections.filter((section) => !section.isComplete).map((section) => (
              <span key={section.section} className="pill">
                {section.section}: {section.totalCount - section.resolvedCount} left
              </span>
            ))}
            {plan.sections.every((section) => section.isComplete) ? <span className="pill pill--success">Ready to review</span> : null}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard
        title={remainingQuestions > 0 ? 'Next question' : 'Ready to review'}
        eyebrow={remainingQuestions > 0 ? `Question ${activeQuestionIndex + 1} of ${remainingQuestions}` : 'Complete'}
      >
        {currentQuestion && RendererComponent ? (
          <div className="wizard-card stack-md">
            <div className="split">
              <span className="pill">{currentQuestion.section}</span>
              {currentQuestion.required ? <span className="pill">Required</span> : null}
            </div>

            <div>
              <h3>{currentQuestion.label}</h3>
              {currentQuestion.helperText ? (
                <p className="muted" style={{ marginTop: '0.25rem' }}>
                  {currentQuestion.helperText}
                </p>
              ) : null}
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

            {validationError ? (
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
                {validationError}
              </div>
            ) : null}

            <div className="button-row" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={handlePrevious}
                  disabled={activeQuestionIndex === 0}
                >
                  Previous
                </button>
                {activeQuestionIndex < plan.unresolvedQuestions.length - 1 ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    onClick={() => {
                      setValidationError(null)
                      setActiveQuestionIndex((prev) => prev + 1)
                    }}
                  >
                    Skip for now
                  </button>
                ) : null}
              </div>
              <button
                className="button"
                type="button"
                onClick={handleSaveAndContinue}
              >
                Save and continue
              </button>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <h3>You are ready to review your application</h3>
            <p className="muted">We have everything we need for now. Please review your details before finishing.</p>
            <Link className="button" to={`/customer/applications/${application.id}/review`}>
              Continue to review
            </Link>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}

export const CustomerReviewPage = () => {
  const { application, customer, confirmCustomerReview } = useAppState()

  const isComplete = application.customerConfirmed

  return (
    <div className="stack-lg">
      <div className="page-header">
        <div>
          <p className="eyebrow">Review</p>
          <h2>{isComplete ? 'Application received' : 'Review your application details'}</h2>
          <p className="lede">
            {isComplete
              ? 'Thanks. We received your application and will review it shortly.'
              : 'Please confirm that the information below looks correct before you finish.'}
          </p>
        </div>
        <StatusBadge status={application.status} />
      </div>

      {isComplete ? (
        <SurfaceCard title="Done" eyebrow="Next step">
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
              <h3 style={{ margin: 0, color: '#047857' }}>Your application is in review</h3>
              <p style={{ marginTop: '0.5rem', marginBottom: 0, lineHeight: 1.6 }}>
                We received the application for <strong>{application.customerName}</strong>. We will reach out if anything else is needed.
              </p>
            </div>

            <div className="button-row">
              <Link className="button" to="/">
                Back to home
              </Link>
            </div>
          </div>
        </SurfaceCard>
      ) : null}

      <div className="grid two-up">
        <SurfaceCard title="Business details">
          <dl className="summary-list">
            <div><dt>Legal name</dt><dd>{application.profile.business.legalName}</dd></div>
            <div><dt>DBA / operating name</dt><dd>{application.profile.business.dba || 'None'}</dd></div>
            <div><dt>Entity type</dt><dd>{application.profile.business.entityType || 'LLC'}</dd></div>
            <div><dt>State of formation</dt><dd>{application.profile.business.stateOfFormation || 'Texas'}</dd></div>
            <div><dt>Tax ID</dt><dd>{application.profile.business.fein || '92-1845601'}</dd></div>
            <div><dt>Annual revenue</dt><dd>${application.profile.business.annualRevenue.toLocaleString()}</dd></div>
            <div><dt>Employees</dt><dd>{application.profile.business.employeeCount}</dd></div>
            <div><dt>Industry code</dt><dd>{application.profile.business.naicsCode}</dd></div>
          </dl>
        </SurfaceCard>

        <SurfaceCard title="Contact and location">
          <dl className="summary-list">
            <div><dt>Contact</dt><dd>{application.profile.people[0]?.fullName || customer.displayName}</dd></div>
            <div><dt>Email</dt><dd>{application.profile.people[0]?.email || customer.email}</dd></div>
            <div><dt>Address</dt><dd>{application.profile.locations[0]?.addressLine1 || '1042 Industrial Pkwy'}</dd></div>
            <div><dt>City, state, ZIP</dt><dd>{application.profile.locations[0]?.city || 'Austin'}, {application.profile.locations[0]?.state || 'TX'} {application.profile.locations[0]?.postalCode || '78758'}</dd></div>
            <div><dt>Occupancy</dt><dd>{application.profile.locations[0]?.occupancy || 'Commercial facility'}</dd></div>
          </dl>
        </SurfaceCard>
      </div>

      <div className="grid two-up">
        <SurfaceCard title="Coverage">
          <dl className="summary-list">
            <div><dt>Current carrier</dt><dd>{application.profile.currentInsurance.carrierName}</dd></div>
            <div><dt>Current limits</dt><dd>{application.profile.currentInsurance.limits}</dd></div>
            <div><dt>Expiration date</dt><dd>{application.profile.currentInsurance.expirationDate}</dd></div>
            <div><dt>Desired effective date</dt><dd>{application.profile.currentInsurance.effectiveDate || '2026-01-01'}</dd></div>
          </dl>
        </SurfaceCard>

        <SurfaceCard title="Operations and loss history">
          <dl className="summary-list">
            <div>
              <dt>Use subcontractors</dt>
              <dd>{getFieldValue(application, 'gl.subcontractorUsage') === true ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt>Subcontractor share</dt>
              <dd>{String(getFieldValue(application, 'gl.subcontractorPercent') ?? '0%')}</dd>
            </div>
            <div>
              <dt>Work mix</dt>
              <dd>{String(getFieldValue(application, 'gl.residentialCommercialMix') ?? '70% Commercial, 30% Residential')}</dd>
            </div>
            <div>
              <dt>Prior losses</dt>
              <dd>{application.profile.lossHistory[0]?.description || 'No losses recorded'}</dd>
            </div>
          </dl>
        </SurfaceCard>
      </div>

      {!isComplete ? (
        <SurfaceCard title="Finish application" eyebrow="Confirmation">
          <p className="muted">
            By continuing, you confirm that the information above is complete and accurate to the best of your knowledge.
          </p>
          <div className="button-row button-row--wrap" style={{ marginTop: '1rem' }}>
            <button className="button" type="button" onClick={confirmCustomerReview}>
              Confirm and finish
            </button>
            <Link className="button button--secondary" to={`/customer/applications/${application.id}/wizard`}>
              Back to questions
            </Link>
          </div>
        </SurfaceCard>
      ) : null}

      {application.conflicts.length > 0 ? (
        <SurfaceCard title="We need to review one item">
          <p style={{ color: '#b91c1c', fontWeight: 600 }}>{application.conflicts[0]?.message}</p>
          <div className="table-like">
            {application.conflicts[0]?.evidence.map((fact) => (
              <div className="table-like__row" key={fact.id}>
                <div>
                  <strong>{fact.sourceDocument ?? 'Customer entry'}</strong>
                  <p className="muted">{fact.sourceType}</p>
                </div>
                <div>
                  <strong>{String(fact.value)}</strong>
                  <p className="muted">Recorded {fact.timestamp.slice(0, 10)}</p>
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  )
}
