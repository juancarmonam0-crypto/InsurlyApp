import type { ApplicationRecord } from '../domain/types'
import { processDocumentIntake } from './application/workflow'

export const simulateDocumentProcessing = (application: ApplicationRecord) => processDocumentIntake(application)
