import type { ApplicationStatus, ConflictStatus, DocumentStatus } from '../domain/types'

type BadgeTone = ApplicationStatus | ConflictStatus | DocumentStatus

const toneMap: Record<BadgeTone, string> = {
  draft: 'muted',
  collecting_information: 'info',
  customer_review: 'accent',
  broker_review: 'warning',
  ready_to_submit: 'success',
  submitted: 'info',
  quoted: 'accent',
  bound: 'success',
  declined: 'danger',
  closed: 'muted',
  open: 'warning',
  clarification_requested: 'danger',
  resolved: 'success',
  uploading: 'muted',
  processing: 'info',
  extracting: 'accent',
  review_required: 'warning',
  complete: 'success',
  uploaded: 'muted',
  classifying: 'info',
  processed: 'success',
  failed: 'danger',
}

const labelMap: Partial<Record<BadgeTone, string>> = {
  collecting_information: 'Collecting information',
  customer_review: 'Customer review',
  broker_review: 'Needs review',
  ready_to_submit: 'Ready to submit',
  clarification_requested: 'Clarification requested',
  review_required: 'Review required',
}

export const StatusBadge = ({ status }: { status: BadgeTone }) => (
  <span className={`badge badge--${toneMap[status]}`}>{labelMap[status] ?? status.replaceAll('_', ' ')}</span>
)
