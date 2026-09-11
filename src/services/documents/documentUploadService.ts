import type { DocumentRecord, DocumentCategory } from '../../domain/types'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '../../adapters/persistence/supabaseClient'
import { storeSessionFile } from './documentFileStore'

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB

export interface UploadDocumentOptions {
  file: File
  agencyId: string
  applicationId?: string
  customerId?: string
  categoryHint?: DocumentCategory
}

export interface UploadResult {
  success: boolean
  document?: DocumentRecord
  error?: string
}

export const validateUploadFile = (file: File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file provided' }
  }

  const isAllowedMime = ALLOWED_MIME_TYPES.some((mime) => file.type.toLowerCase().includes(mime.toLowerCase()) || file.type.toLowerCase() === mime.toLowerCase())
  const hasAllowedExt = /\.(pdf|png|jpe?g|webp)$/i.test(file.name)

  if (!isAllowedMime && !hasAllowedExt) {
    return {
      valid: false,
      error: `Unsupported file type "${file.type || 'unknown'}". Allowed formats: PDF, PNG, JPEG, WEBP.`,
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed limit of 20 MB.`,
    }
  }

  return { valid: true }
}

export const detectCategoryFromFileName = (fileName: string): DocumentCategory => {
  const lower = fileName.toLowerCase()
  if (lower.includes('policy') || lower.includes('dec') || lower.includes('declarations')) return 'current_policy'
  if (lower.includes('acord') || lower.includes('app') || lower.includes('125') || lower.includes('126')) return 'prior_acord_application'
  if (lower.includes('loss') || lower.includes('claim') || lower.includes('run')) return 'loss_runs'
  if (lower.includes('vehicle') || lower.includes('auto') || lower.includes('fleet')) return 'vehicle_schedule'
  if (lower.includes('business') || lower.includes('entity') || lower.includes('cert') || lower.includes('tax') || lower.includes('w9')) return 'business_document'
  return 'unknown'
}

export const uploadDocumentFile = async ({
  file,
  agencyId,
  applicationId,
  customerId,
  categoryHint,
}: UploadDocumentOptions): Promise<UploadResult> => {
  const validation = validateUploadFile(file)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const category = categoryHint || detectCategoryFromFileName(file.name)
  let storagePath: string | undefined = undefined

  // Save to in-memory session cache for immediate browser-to-server extraction
  await storeSessionFile(documentId, file, file.name)

  // If Supabase is configured, upload to private bucket
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseBrowserClient()
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const targetPath = `${agencyId}/${customerId || 'customer'}/${applicationId || 'draft'}/${documentId}_${sanitizedName}`

      const { data, error: uploadError } = await supabase.storage
        .from('insurance-documents')
        .upload(targetPath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        console.warn('Supabase storage upload failed, fallback to session storage:', uploadError.message)
      } else if (data) {
        storagePath = data.path
      }
    } catch (err) {
      console.warn('Failed to upload to Supabase storage, using session storage:', err)
    }
  }

  const documentRecord: DocumentRecord = {
    agency_id: agencyId,
    id: documentId,
    application_id: applicationId,
    customer_id: customerId,
    type: file.type || 'application/pdf',
    category,
    fileName: file.name,
    status: 'uploaded',
    uploadedAt: new Date().toISOString(),
    mimeType: file.type || 'application/pdf',
    fileSize: file.size,
    source: 'uploaded',
    storagePath,
    metadata: {
      originalName: file.name,
      size: file.size,
      lastModified: file.lastModified,
    },
  }

  return {
    success: true,
    document: documentRecord,
  }
}
