import type {
  ApplicationRecord,
  DocumentExtractionResult,
  DocumentExtractionSummary,
  DocumentRecord,
  ExtractedCandidateFact,
} from '../../domain/types'
import { DemoExtractionProvider, type DocumentExtractionProvider } from './demoExtractionProvider'
import { validateExtractionResult } from './extractionContract'
import { ingestDocumentExtraction } from './documentIngestionEngine'

export interface ProcessDocumentOptions {
  documentId: string
  application: ApplicationRecord
  provider?: DocumentExtractionProvider
}

export interface DocumentProcessingResult {
  document: DocumentRecord
  extraction?: DocumentExtractionResult
  acceptedFacts: ExtractedCandidateFact[]
  reviewRequiredFacts: ExtractedCandidateFact[]
  unmappedFacts: ExtractedCandidateFact[]
  conflictsCreatedCount: number
  application: ApplicationRecord
  success: boolean
  error?: string
}

export const processDocument = async ({
  documentId,
  application,
  provider = new DemoExtractionProvider(),
}: ProcessDocumentOptions): Promise<DocumentProcessingResult> => {
  const targetDoc = application.profile.documents.find((doc) => doc.id === documentId)

  if (!targetDoc) {
    return {
      document: {
        agency_id: application.agency_id,
        id: documentId,
        fileName: 'Unknown Document',
        type: 'Unknown',
        status: 'failed',
        uploadedAt: new Date().toISOString(),
        failureReason: `Document with ID "${documentId}" not found in application`,
      },
      acceptedFacts: [],
      reviewRequiredFacts: [],
      unmappedFacts: [],
      conflictsCreatedCount: 0,
      application,
      success: false,
      error: `Document with ID "${documentId}" not found in application`,
    }
  }

  try {
    // 1. Classification
    const classification = await provider.classifyDocument(targetDoc)
    const category = targetDoc.category || classification.category

    const classifyingDoc: DocumentRecord = {
      ...targetDoc,
      category,
      status: 'classifying',
    }

    // 2. Extraction
    const extractionResult = await provider.extractDocument(classifyingDoc)

    // 3. Validation
    const validation = validateExtractionResult(extractionResult)
    if (!validation.valid) {
      const errorMsg = `Extraction validation failed: ${validation.errors.join('; ')}`
      const failedDoc: DocumentRecord = {
        ...classifyingDoc,
        status: 'failed',
        failureReason: errorMsg,
      }
      const updatedDocs = application.profile.documents.map((d) => (d.id === documentId ? failedDoc : d))

      return {
        document: failedDoc,
        extraction: extractionResult,
        acceptedFacts: [],
        reviewRequiredFacts: [],
        unmappedFacts: [],
        conflictsCreatedCount: 0,
        application: {
          ...application,
          profile: { ...application.profile, documents: updatedDocs },
        },
        success: false,
        error: errorMsg,
      }
    }

    // 4. Safe Domain Ingestion
    const outcome = ingestDocumentExtraction(application, classifyingDoc, extractionResult)

    const processedAt = new Date().toISOString()
    const summary: DocumentExtractionSummary = {
      documentId,
      documentCategory: category,
      classificationConfidence: classification.confidence,
      totalFactsFound: extractionResult.fields.length,
      acceptedFactsCount: outcome.acceptedFacts.length,
      reviewRequiredCount: outcome.reviewRequiredFacts.length,
      unmappedCount: outcome.unmappedFacts.length,
      conflictsCreatedCount: outcome.conflictsCreatedCount,
      processedAt,
      warnings: extractionResult.warnings || [],
    }

    const finalDocStatus = outcome.reviewRequiredFacts.length > 0 ? 'review_required' : 'processed'
    const processedDoc: DocumentRecord = {
      ...classifyingDoc,
      status: finalDocStatus,
      processedAt,
      extractionSummary: summary,
    }

    const updatedDocuments = outcome.application.profile.documents.map((d) =>
      d.id === documentId ? processedDoc : d,
    )

    const finalApplication: ApplicationRecord = {
      ...outcome.application,
      profile: {
        ...outcome.application.profile,
        documents: updatedDocuments,
      },
    }

    return {
      document: processedDoc,
      extraction: extractionResult,
      acceptedFacts: outcome.acceptedFacts,
      reviewRequiredFacts: outcome.reviewRequiredFacts,
      unmappedFacts: outcome.unmappedFacts,
      conflictsCreatedCount: outcome.conflictsCreatedCount,
      application: finalApplication,
      success: true,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown document processing error'
    const failedDoc: DocumentRecord = {
      ...targetDoc,
      status: 'failed',
      failureReason: errorMsg,
    }
    const updatedDocs = application.profile.documents.map((d) => (d.id === documentId ? failedDoc : d))

    return {
      document: failedDoc,
      acceptedFacts: [],
      reviewRequiredFacts: [],
      unmappedFacts: [],
      conflictsCreatedCount: 0,
      application: {
        ...application,
        profile: { ...application.profile, documents: updatedDocs },
      },
      success: false,
      error: errorMsg,
    }
  }
}
