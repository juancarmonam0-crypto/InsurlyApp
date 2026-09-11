export interface ChatIntakeService {
  startConversation(applicationId: string): Promise<{ conversationId: string }>
}

export interface DocumentAnalysisService {
  analyzeDocument(documentId: string): Promise<{ extractionBatchId: string }>
}

export interface CarrierSubmissionService {
  createSubmission(applicationId: string, formVersionId: string): Promise<{ submissionId: string }>
}

export interface MessagingService {
  sendCustomerRequest(applicationId: string, channel: 'email' | 'sms' | 'whatsapp'): Promise<{ requestId: string }>
}
