export type ApplicationStatus =
  | 'draft'
  | 'collecting_information'
  | 'customer_review'
  | 'broker_review'
  | 'ready_to_submit'
  | 'submitted'
  | 'quoted'
  | 'bound'
  | 'declined'
  | 'closed'

export type SourceType =
  | 'customer_answer'
  | 'chatgpt'
  | 'document_ai'
  | 'broker'
  | 'carrier'
  | 'existing_profile'
  | 'broker_entry'
  | 'previous_application'
  | 'application_promotion'

export type ProfileEntityKind =
  | 'customer'
  | 'business'
  | 'person'
  | 'location'
  | 'vehicle'
  | 'policy'
  | 'loss'
  | 'document'

export interface ProfileFactMetadata {
  id: string
  agency_id: string
  customer_id: string
  entityType: ProfileEntityKind
  entityId?: string
  fieldKey: string
  value: FieldValue
  sourceType: SourceType
  sourceReference?: string
  confidence?: number
  customerConfirmed: boolean
  brokerVerified: boolean
  updatedAt: string
  metadata?: Record<string, string | number | boolean>
}

export type DocumentStatus =
  | 'uploaded'
  | 'uploading'
  | 'classifying'
  | 'processing'
  | 'extracting'
  | 'review_required'
  | 'processed'
  | 'complete'
  | 'failed'

export type DocumentCategory =
  | 'current_policy'
  | 'prior_acord_application'
  | 'loss_runs'
  | 'business_document'
  | 'vehicle_schedule'
  | 'unknown'

export type CandidateFactStatus =
  | 'valid'
  | 'invalid'
  | 'review_required'
  | 'entity_resolution_required'
  | 'unmapped'

export interface ExtractedCandidateFact {
  id: string
  rawLabel: string
  rawValue: FieldValue
  proposedCanonicalField: string
  canonicalField: string
  entityType: ProfileEntityKind
  entityId?: string
  normalizedValue: FieldValue
  confidence: number
  page?: number
  evidenceText?: string
  extractionMethod?: string
  warnings?: string[]
  status: CandidateFactStatus
}

export interface DocumentExtractionResult {
  documentId: string
  documentType: DocumentCategory
  classificationConfidence: number
  fields: ExtractedCandidateFact[]
  warnings: string[]
  providerMetadata?: Record<string, string | number | boolean>
}

export interface DocumentExtractionSummary {
  documentId: string
  documentCategory: DocumentCategory
  classificationConfidence: number
  totalFactsFound: number
  acceptedFactsCount: number
  reviewRequiredCount: number
  unmappedCount: number
  conflictsCreatedCount: number
  processedAt: string
  warnings: string[]
}

export type ConflictStatus = 'open' | 'clarification_requested' | 'resolved'

export type ConflictResolutionType = 'accept_customer' | 'use_evidence' | 'request_clarification' | 'correct_value'

export type ChannelType = 'chatgpt' | 'document_upload' | 'smart_wizard'

export type FieldValue = string | number | boolean | string[]

export type RequirementInputType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multi-select'
  | 'address'
  | 'person'
  | 'vehicle'
  | 'file_upload'

export type CustomerType = 'business' | 'individual'

export type PersistenceMode = 'local' | 'supabase'

export type PersistenceState = 'loading' | 'ready' | 'error'

export interface AgencyConfig {
  id: string
  name: string
  logoText: string
  primaryColor: string
  primaryTint: string
  contactEmail: string
  phone: string
  customDomain: string
}

export interface BusinessProfile {
  agency_id: string
  legalName: string
  dba?: string
  entityType: string
  stateOfFormation: string
  annualRevenue: number
  naicsCode: string
  employeeCount: number
  yearsInBusiness?: number
  fein?: string
  description: string
}

export interface PersonProfile {
  agency_id: string
  id: string
  fullName: string
  role: string
  email: string
  phone: string
}

export interface LocationProfile {
  agency_id: string
  id: string
  label: string
  addressLine1: string
  city: string
  state: string
  postalCode: string
  occupancy: string
}

export interface VehicleProfile {
  agency_id: string
  id: string
  year: number
  make: string
  model: string
  vin: string
  usage: string
}

export interface PolicyProfile {
  agency_id: string
  carrierName: string
  effectiveDate?: string
  expirationDate: string
  limits: string
  premium: number
}

export interface LossRecord {
  agency_id: string
  id: string
  date: string
  description: string
  amount: number
  status: string
}

export interface DocumentRecord {
  agency_id: string
  id: string
  application_id?: string
  customer_id?: string
  type: string
  category?: DocumentCategory
  fileName: string
  status: DocumentStatus
  uploadedAt: string
  processedAt?: string
  failureReason?: string
  storagePath?: string
  mimeType?: string
  metadata?: Record<string, string | number | boolean>
  extractionSummary?: DocumentExtractionSummary
}

export interface FieldProvenance {
  id: string
  agency_id: string
  application_id: string
  canonicalField: string
  label: string
  value: FieldValue
  sourceType: SourceType
  sourceDocument?: string
  sourcePage?: number
  confidence?: number
  customerConfirmed: boolean
  brokerVerified: boolean
  timestamp: string
  metadata?: Record<string, string | number | boolean>
}

export interface ApplicationFieldState {
  canonicalField: string
  selectedValue?: FieldValue
  selectedEvidenceId?: string
  customerConfirmed: boolean
  brokerVerified: boolean
  updatedAt: string
}

export interface ConflictResolutionRecord {
  type: ConflictResolutionType
  correctedValue?: FieldValue
  note?: string
  resolvedAt: string
}

export interface ConflictRecord {
  id: string
  agency_id: string
  application_id: string
  canonicalField: string
  label: string
  status: ConflictStatus
  message: string
  customerValue: FieldValue
  evidence: FieldProvenance[]
  material: boolean
  blocking: boolean
  updatedAt: string
  resolution?: ConflictResolutionRecord
}

export interface CanonicalProfile {
  agency_id: string
  customer_id: string
  application_id: string
  preferredChannel: ChannelType
  business: BusinessProfile
  people: PersonProfile[]
  locations: LocationProfile[]
  vehicles: VehicleProfile[]
  currentInsurance: PolicyProfile
  lossHistory: LossRecord[]
  documents: DocumentRecord[]
  fieldProvenance: FieldProvenance[]
}

export interface CustomerProfile {
  agency_id: string
  customer_id: string
  preferredChannel: ChannelType
  business: BusinessProfile
  people: PersonProfile[]
  locations: LocationProfile[]
  vehicles: VehicleProfile[]
  currentInsurance: PolicyProfile
  lossHistory: LossRecord[]
  documents: DocumentRecord[]
  facts?: ProfileFactMetadata[]
}

export interface CustomerRecord {
  id: string
  agency_id: string
  type: CustomerType
  displayName: string
  email?: string
  phone?: string
  createdAt: string
  updatedAt: string
  profile: CustomerProfile
}

export interface ValidationMetadata {
  min?: number
  max?: number
  pattern?: string
}

export interface RequirementDefinition {
  id: string
  canonicalField: string
  label: string
  section: string
  inputType: RequirementInputType
  required: boolean
  material: boolean
  requiresCustomerConfirmation: boolean
  requiresBrokerVerification: boolean
  validation?: ValidationMetadata
  applicability?: {
    field: string
    equals: FieldValue
  }
  sectionOrder?: number
  questionOrder?: number
  helperText?: string
  placeholder?: string
  options?: { label: string; value: string | number | boolean }[]
  profileReusable?: boolean
}

export interface ApplicationDefinition {
  id: string
  lineOfBusiness: string
  version: number
  requirements: RequirementDefinition[]
}

export interface RequirementEvaluation {
  requirement: RequirementDefinition
  applicable: boolean
  satisfied: boolean
  value?: FieldValue
  customerConfirmationPending: boolean
  brokerVerificationPending: boolean
}

export interface ReadinessBlocker {
  type: 'missing_requirement' | 'customer_confirmation' | 'broker_verification' | 'conflict'
  canonicalField?: string
  message: string
}

export interface ReadinessResult {
  ready: boolean
  blockers: ReadinessBlocker[]
  missingRequirements: RequirementEvaluation[]
  unresolvedConflicts: ConflictRecord[]
  missingConfirmations: RequirementEvaluation[]
  missingBrokerVerifications: RequirementEvaluation[]
}

export interface ApplicationRecord {
  agency_id: string
  id: string
  customerId: string
  customerName: string
  lineOfBusiness: string
  definitionId: string
  definitionVersion: number
  status: ApplicationStatus
  completion: number
  profile: CanonicalProfile
  fieldStates: ApplicationFieldState[]
  missingFields: string[]
  conflicts: ConflictRecord[]
  customerConfirmed: boolean
  brokerVerified: boolean
  brokerNotes: string[]
  generatedAt?: string
  createdAt: string
  updatedAt: string
}

export interface SnapshotMappingResult {
  mappedCount: number
  missingCount: number
  reviewRequiredCount: number
  rows: MappingRow[]
}

export interface ApplicationSnapshotPayload {
  applicationId: string
  agencyId: string
  customerId: string
  definitionId: string
  definitionVersion: number
  lineOfBusiness: string
  status: ApplicationStatus
  completion: number
  fieldStates: ApplicationFieldState[]
  customerConfirmed: boolean
  brokerVerified: boolean
  profile: CanonicalProfile
  provenance: FieldProvenance[]
  conflicts: ConflictRecord[]
  readiness: ReadinessResult
  mappingResult?: SnapshotMappingResult
  generatedAt?: string
  createdAt: string
}

export interface ApplicationSnapshotRecord {
  id: string
  agency_id: string
  application_id: string
  applicationDefinitionId: string
  applicationDefinitionVersion: number
  snapshotHash: string
  createdAt: string
  createdBy: string
  snapshot: ApplicationSnapshotPayload
}

export interface WizardQuestionOption {
  label: string
  value: string
}

export interface WizardQuestion {
  id: string
  canonicalField: string
  label: string
  helperText: string
  section: string
  type: RequirementInputType
  options?: WizardQuestionOption[]
  required?: boolean
}

export interface MappingDefinition {
  canonicalField: string
  displayLabel: string
  targetField: string
  transform?: (value: FieldValue) => string
}

export interface MappingRow {
  acordField: string
  canonicalField: string
  value: string
  status: 'mapped' | 'missing' | 'review_required'
  note: string
}

export interface AcordPreview {
  status: string
  mappedCount: number
  missingCount: number
  reviewRequiredCount: number
  rows: MappingRow[]
  generatedPreview: string
}

export interface BrokerMetric {
  label: string
  count: number
}
