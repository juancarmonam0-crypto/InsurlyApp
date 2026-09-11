import { describe, it, expect, beforeEach } from 'vitest'
import {
  validateUploadFile,
  detectCategoryFromFileName,
  uploadDocumentFile,
} from './documentUploadService'
import { RealExtractionProvider } from './realExtractionProvider'
import { processDocument } from './documentProcessingService'
import { getSessionFile, clearSessionFiles } from './documentFileStore'
import { demoApplication } from '../../data/mock/insurly'
import { recalculateApplication } from '../application/workflow'
import type { ApplicationRecord } from '../../domain/types'

describe('INSURLY V0.7.1 Real Document Upload & Extraction Engine', () => {
  beforeEach(() => {
    clearSessionFiles()
  })

  describe('File Validation and Upload Service', () => {
    it('validates supported file types (PDF, PNG, JPEG, WEBP)', () => {
      const validPdf = new File(['fake pdf content'], 'declarations_page.pdf', { type: 'application/pdf' })
      const validPng = new File(['fake png content'], 'acord_scan.png', { type: 'image/png' })
      const validJpg = new File(['fake jpg content'], 'loss_run.jpg', { type: 'image/jpeg' })
      const validWebp = new File(['fake webp content'], 'fleet.webp', { type: 'image/webp' })

      expect(validateUploadFile(validPdf).valid).toBe(true)
      expect(validateUploadFile(validPng).valid).toBe(true)
      expect(validateUploadFile(validJpg).valid).toBe(true)
      expect(validateUploadFile(validWebp).valid).toBe(true)
    })

    it('rejects unsupported file formats and oversized files', () => {
      const invalidExe = new File(['evil code'], 'malware.exe', { type: 'application/x-msdownload' })
      const validationExe = validateUploadFile(invalidExe)
      expect(validationExe.valid).toBe(false)
      expect(validationExe.error).toContain('Unsupported file type')

      // Oversized file > 20MB
      const bigBuffer = new ArrayBuffer(21 * 1024 * 1024)
      const oversizedFile = new File([bigBuffer], 'huge_policy.pdf', { type: 'application/pdf' })
      const validationBig = validateUploadFile(oversizedFile)
      expect(validationBig.valid).toBe(false)
      expect(validationBig.error).toContain('exceeds maximum allowed limit')
    })

    it('accurately detects category from filename cues', () => {
      expect(detectCategoryFromFileName('Apex_Policy_Declarations_2025.pdf')).toBe('current_policy')
      expect(detectCategoryFromFileName('Acord_125_Commercial_Application.pdf')).toBe('prior_acord_application')
      expect(detectCategoryFromFileName('Hartford_Loss_Runs_5Year.pdf')).toBe('loss_runs')
      expect(detectCategoryFromFileName('Commercial_Vehicle_Fleet_Schedule.png')).toBe('vehicle_schedule')
      expect(detectCategoryFromFileName('Certificate_Of_Formation_LLC.pdf')).toBe('business_document')
      expect(detectCategoryFromFileName('random_notes.txt')).toBe('unknown')
    })

    it('uploads real document, creates DocumentRecord, and caches session binary without state leakage', async () => {
      const file = new File(['test document binary stream'], 'Travelers_GL_Policy.pdf', { type: 'application/pdf' })
      const uploadResult = await uploadDocumentFile({
        file,
        agencyId: 'agency-101',
        applicationId: 'app-505',
        customerId: 'cust-909',
      })

      expect(uploadResult.success).toBe(true)
      expect(uploadResult.document).toBeDefined()

      const doc = uploadResult.document!
      expect(doc.fileName).toBe('Travelers_GL_Policy.pdf')
      expect(doc.source).toBe('uploaded')
      expect(doc.status).toBe('uploaded')
      expect(doc.category).toBe('current_policy')
      expect(doc.fileSize).toBe(file.size)

      // Confirm binary is stored in session cache
      const cached = getSessionFile(doc.id)
      expect(cached).toBeDefined()
      expect(cached?.fileName).toBe('Travelers_GL_Policy.pdf')
    })
  })

  describe('RealExtractionProvider and Pipeline Ingestion', () => {
    it('classifies and extracts structured facts with evidence provenance from uploaded policy', async () => {
      const provider = new RealExtractionProvider()
      const doc = {
        agency_id: 'agency-101',
        id: 'doc-real-123',
        fileName: 'Commercial_General_Liability_Policy.pdf',
        type: 'application/pdf',
        category: 'current_policy' as const,
        status: 'uploaded' as const,
        uploadedAt: new Date().toISOString(),
        source: 'uploaded' as const,
      }

      const extraction = await provider.extractDocument(doc)
      expect(extraction.documentId).toBe(doc.id)
      expect(extraction.documentType).toBe('current_policy')
      expect(extraction.classificationConfidence).toBeGreaterThanOrEqual(0.8)
      expect(extraction.fields.length).toBeGreaterThan(0)

      const carrierFact = extraction.fields.find((f) => f.canonicalField === 'currentInsurance.carrierName')
      expect(carrierFact).toBeDefined()
      expect(carrierFact?.normalizedValue).toBe('Hartford Fire Insurance Co')
      expect(carrierFact?.evidenceText).toContain('Hartford')
      expect(carrierFact?.confidence).toBeGreaterThan(0.85)
    })

    it('processes real uploaded document through full end-to-end ingestion pipeline', async () => {
      const baseApp = structuredClone(demoApplication)
      const file = new File(['policy dummy content'], 'Prior_Carrier_Declarations.pdf', { type: 'application/pdf' })

      const uploadResult = await uploadDocumentFile({
        file,
        agencyId: baseApp.agency_id,
        applicationId: baseApp.id,
      })

      expect(uploadResult.success).toBe(true)
      const uploadedDoc = uploadResult.document!

      // Add uploaded document into application
      const appWithDoc: ApplicationRecord = recalculateApplication({
        ...baseApp,
        profile: {
          ...baseApp.profile,
          documents: [uploadedDoc, ...baseApp.profile.documents],
        },
      })

      // Process document with AI
      const processResult = await processDocument({
        documentId: uploadedDoc.id,
        application: appWithDoc,
      })

      expect(processResult.success).toBe(true)
      expect(processResult.document.status).toBe('processed')
      expect(processResult.document.extractionSummary).toBeDefined()
      expect(processResult.acceptedFacts.length).toBeGreaterThan(0)

      // Verify field provenance recorded
      const provenance = processResult.application.profile.fieldProvenance
      const matchingProvenance = provenance.filter((p) => p.sourceDocument === 'Prior_Carrier_Declarations.pdf')
      expect(matchingProvenance.length).toBeGreaterThan(0)

      // Verify application missing fields updated
      expect(processResult.application.missingFields.length).toBeLessThanOrEqual(
        appWithDoc.missingFields.length,
      )
    })
  })
})
