import type {
  ApplicationRecord,
  DocumentExtractionResult,
  DocumentRecord,
  ExtractedCandidateFact,
  FieldProvenance,
} from '../../domain/types'
import { getFieldValue, hasMeaningfulValue, setFieldValue } from '../application/fieldAccess'
import { valuesEquivalent } from '../conflicts/normalization'
import { recalculateApplication } from '../application/workflow'
import { resolveCanonicalMapping } from './canonicalResolver'
import { getConfidenceTier } from './confidencePolicy'

export interface IngestionOutcome {
  acceptedFacts: ExtractedCandidateFact[]
  reviewRequiredFacts: ExtractedCandidateFact[]
  unmappedFacts: ExtractedCandidateFact[]
  conflictsCreatedCount: number
  application: ApplicationRecord
}

export const ingestDocumentExtraction = (
  application: ApplicationRecord,
  document: DocumentRecord,
  extractionResult: DocumentExtractionResult,
): IngestionOutcome => {
  let workingApp = structuredClone(application)
  const acceptedFacts: ExtractedCandidateFact[] = []
  const reviewRequiredFacts: ExtractedCandidateFact[] = []
  const unmappedFacts: ExtractedCandidateFact[] = []
  let conflictsCreatedCount = 0

  for (const rawFact of extractionResult.fields) {
    const fact = resolveCanonicalMapping(rawFact, workingApp)

    if (fact.status === 'unmapped') {
      unmappedFacts.push(fact)
      continue
    }

    if (fact.status === 'invalid' || fact.status === 'entity_resolution_required') {
      reviewRequiredFacts.push(fact)
      continue
    }

    const canonicalField = fact.canonicalField
    const normalizedVal = fact.normalizedValue
    const confidence = fact.confidence
    const tier = getConfidenceTier(confidence)

    const existingState = workingApp.fieldStates.find((fs) => fs.canonicalField === canonicalField)
    const existingVal = getFieldValue(workingApp, canonicalField)

    const timestamp = new Date().toISOString()
    const provenance: FieldProvenance = {
      id: `prov-doc-${document.id}-${fact.id}`,
      agency_id: workingApp.agency_id,
      application_id: workingApp.id,
      canonicalField,
      label: fact.rawLabel,
      value: normalizedVal,
      sourceType: 'document_ai',
      sourceDocument: document.fileName,
      sourcePage: fact.page,
      confidence,
      customerConfirmed: false,
      brokerVerified: false,
      timestamp,
      metadata: {
        rawLabel: fact.rawLabel,
        rawValue: String(fact.rawValue),
        evidenceText: fact.evidenceText || '',
        documentId: document.id,
        documentType: extractionResult.documentType,
      },
    }

    // Always record provenance in draft profile fieldProvenance
    workingApp = {
      ...workingApp,
      profile: {
        ...workingApp.profile,
        fieldProvenance: [...workingApp.profile.fieldProvenance, provenance],
      },
    }

    const isConfirmedOrVerified = Boolean(existingState?.customerConfirmed || existingState?.brokerVerified)
    const hasExistingVal = hasMeaningfulValue(existingVal)

    // CASE F: Field customer-confirmed or broker-verified
    if (isConfirmedOrVerified) {
      if (hasExistingVal && !valuesEquivalent(existingVal, normalizedVal)) {
        conflictsCreatedCount += 1
        const conflictId = `conflict-${canonicalField}`
        const existingConflict = workingApp.conflicts.find((c) => c.id === conflictId)
        const updatedConflicts = existingConflict
          ? workingApp.conflicts.map((c) =>
              c.id === conflictId ? { ...c, evidence: [...c.evidence, provenance], updatedAt: timestamp } : c,
            )
          : [
              ...workingApp.conflicts,
              {
                id: conflictId,
                agency_id: workingApp.agency_id,
                application_id: workingApp.id,
                canonicalField,
                label: fact.rawLabel,
                status: 'open' as const,
                message: `Document evidence from ${document.fileName} (${String(normalizedVal)}) conflicts with verified value (${String(existingVal)}).`,
                customerValue: existingVal!,
                evidence: [provenance],
                material: true,
                blocking: true,
                updatedAt: timestamp,
              },
            ]
        workingApp = { ...workingApp, conflicts: updatedConflicts }
      }
      acceptedFacts.push(fact)
      continue
    }

    // CASE B / D: Field has value & semantically equivalent
    if (hasExistingVal && valuesEquivalent(existingVal, normalizedVal)) {
      acceptedFacts.push(fact)
      continue
    }

    // CASE C: Field has value & materially different
    if (hasExistingVal && !valuesEquivalent(existingVal, normalizedVal)) {
      conflictsCreatedCount += 1
      const conflictId = `conflict-${canonicalField}`
      const existingConflict = workingApp.conflicts.find((c) => c.id === conflictId)
      const updatedConflicts = existingConflict
        ? workingApp.conflicts.map((c) =>
            c.id === conflictId ? { ...c, evidence: [...c.evidence, provenance], updatedAt: timestamp } : c,
          )
        : [
            ...workingApp.conflicts,
            {
              id: conflictId,
              agency_id: workingApp.agency_id,
              application_id: workingApp.id,
              canonicalField,
              label: fact.rawLabel,
              status: 'open' as const,
              message: `Document evidence from ${document.fileName} (${String(normalizedVal)}) conflicts with entered value (${String(existingVal)}).`,
              customerValue: existingVal!,
              evidence: [provenance],
              material: true,
              blocking: true,
              updatedAt: timestamp,
            },
          ]
      workingApp = { ...workingApp, conflicts: updatedConflicts }
      acceptedFacts.push(fact)
      continue
    }

    // CASE A: Field is empty
    if (!hasExistingVal) {
      if (tier === 'HIGH') {
        // High confidence: populate field state as unconfirmed evidence
        workingApp = setFieldValue(workingApp, canonicalField, normalizedVal)
        acceptedFacts.push(fact)
      } else {
        // Medium / Low confidence: keep field empty, require review
        reviewRequiredFacts.push(fact)
      }
      continue
    }

    acceptedFacts.push(fact)
  }

  const recalculated = recalculateApplication(workingApp)

  return {
    acceptedFacts,
    reviewRequiredFacts,
    unmappedFacts,
    conflictsCreatedCount,
    application: recalculated,
  }
}
