import type { ApplicationRecord } from '../domain/types'
import { processDocumentIntake } from './application/workflow'
import { processDocument, type DocumentProcessingResult } from './documents/documentProcessingService'

export const simulateDocumentProcessing = (application: ApplicationRecord) => processDocumentIntake(application)

export const processSingleDocument = (application: ApplicationRecord, documentId: string): Promise<DocumentProcessingResult> =>
  processDocument({ documentId, application })

export const processAllApplicationDocuments = async (application: ApplicationRecord): Promise<ApplicationRecord> => {
  let currentApp = structuredClone(application)
  for (const doc of currentApp.profile.documents) {
    if (doc.status !== 'processed' && doc.status !== 'complete') {
      const res = await processDocument({ documentId: doc.id, application: currentApp })
      if (res.success) {
        currentApp = res.application
      }
    }
  }
  return currentApp
}

