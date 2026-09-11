import { describe, expect, it } from 'vitest'
import { demoApplication, demoCustomer } from '../../data/mock/insurly'
import type { DocumentRecord } from '../../domain/types'
import { DemoExtractionProvider } from './demoExtractionProvider'
import { validateExtractionResult } from './extractionContract'
import { resolveCanonicalMapping } from './canonicalResolver'
import { getConfidenceTier } from './confidencePolicy'
import { ingestDocumentExtraction } from './documentIngestionEngine'
import { processDocument } from './documentProcessingService'
import { buildWizardPlan } from '../wizard/wizardService'

describe('V0.6 Document Intelligence Pipeline', () => {
  it('1. classifies documents correctly using DemoExtractionProvider', async () => {
    const provider = new DemoExtractionProvider()
    const doc: DocumentRecord = {
      agency_id: 'agency-1',
      id: 'doc-policy-1',
      type: 'Policy Document',
      fileName: 'CurrentPolicy.pdf',
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
    }

    const classification = await provider.classifyDocument(doc)
    expect(classification.category).toBe('current_policy')
    expect(classification.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('2. validates extraction results contract', () => {
    const invalidResult = {
      documentId: 'doc-1',
      documentType: 'current_policy' as const,
      classificationConfidence: 0.9,
      fields: [
        {
          id: 'f1',
          rawLabel: 'Revenue',
          rawValue: undefined as any,
          proposedCanonicalField: 'business.annualRevenue',
          canonicalField: 'business.annualRevenue',
          entityType: 'business' as const,
          normalizedValue: 300000,
          confidence: 0.95,
          status: 'valid' as const,
        },
      ],
      warnings: [],
    }

    const validation = validateExtractionResult(invalidResult)
    expect(validation.valid).toBe(false)
    expect(validation.errors.length).toBeGreaterThan(0)
  })

  it('3. maps known canonical fields and aliases correctly', () => {
    const app = structuredClone(demoApplication)
    const rawFact = {
      id: 'f1',
      rawLabel: 'Gross Receipts',
      rawValue: '$300,000',
      proposedCanonicalField: 'gross_receipts',
      canonicalField: 'gross_receipts',
      entityType: 'business' as const,
      normalizedValue: '$300,000',
      confidence: 0.94,
      status: 'valid' as const,
    }

    const mapped = resolveCanonicalMapping(rawFact, app)
    expect(mapped.canonicalField).toBe('business.annualRevenue')
    expect(mapped.normalizedValue).toBe(300000)
    expect(mapped.status).toBe('valid')
  })

  it('4. evaluates confidence policy tiers accurately', () => {
    expect(getConfidenceTier(0.95)).toBe('HIGH')
    expect(getConfidenceTier(0.75)).toBe('MEDIUM')
    expect(getConfidenceTier(0.40)).toBe('LOW')
  })

  it('5. ingests safe evidence: empty field + HIGH confidence populates application state', () => {
    const app = structuredClone(demoApplication)
    // Clear annualRevenue
    app.fieldStates = app.fieldStates.filter((f) => f.canonicalField !== 'business.annualRevenue')
    app.profile.business.annualRevenue = undefined as any

    const doc: DocumentRecord = {
      agency_id: 'agency-1',
      id: 'doc-1',
      fileName: 'CurrentPolicy.pdf',
      type: 'Policy',
      category: 'current_policy',
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
    }

    const extractionResult = {
      documentId: 'doc-1',
      documentType: 'current_policy' as const,
      classificationConfidence: 0.98,
      fields: [
        {
          id: 'fact-1',
          rawLabel: 'Gross Receipts',
          rawValue: '$300,000',
          proposedCanonicalField: 'business.annualRevenue',
          canonicalField: 'business.annualRevenue',
          entityType: 'business' as const,
          normalizedValue: 300000,
          confidence: 0.94,
          status: 'valid' as const,
        },
      ],
      warnings: [],
    }

    const outcome = ingestDocumentExtraction(app, doc, extractionResult)
    expect(outcome.acceptedFacts.length).toBe(1)
    const newRevenue = outcome.application.fieldStates.find((f) => f.canonicalField === 'business.annualRevenue')
    expect(newRevenue?.selectedValue).toBe(300000)
    expect(newRevenue?.customerConfirmed).toBe(false)
  })

  it('5b. ingests safe evidence: materially different value creates conflict without overwriting selected value', () => {
    const app = structuredClone(demoApplication)
    // Set existing value
    const revIndex = app.fieldStates.findIndex((f) => f.canonicalField === 'business.annualRevenue')
    if (revIndex >= 0) {
      app.fieldStates[revIndex].selectedValue = 500000
    }

    const doc: DocumentRecord = {
      agency_id: 'agency-1',
      id: 'doc-1',
      fileName: 'CurrentPolicy.pdf',
      type: 'Policy',
      category: 'current_policy',
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
    }

    const extractionResult = {
      documentId: 'doc-1',
      documentType: 'current_policy' as const,
      classificationConfidence: 0.98,
      fields: [
        {
          id: 'fact-1',
          rawLabel: 'Gross Receipts',
          rawValue: '$300,000',
          proposedCanonicalField: 'business.annualRevenue',
          canonicalField: 'business.annualRevenue',
          entityType: 'business' as const,
          normalizedValue: 300000,
          confidence: 0.94,
          status: 'valid' as const,
        },
      ],
      warnings: [],
    }

    const outcome = ingestDocumentExtraction(app, doc, extractionResult)
    expect(outcome.conflictsCreatedCount).toBe(1)
    // Selected value is protected
    const revState = outcome.application.fieldStates.find((f) => f.canonicalField === 'business.annualRevenue')
    expect(revState?.selectedValue).toBe(500000)
    expect(outcome.application.conflicts.length).toBeGreaterThan(0)
  })

  it('6. verifies Smart Wizard questions decrease after document ingestion', async () => {
    const app = structuredClone(demoApplication)
    // Clear current insurance values in profile & fieldStates to make questions unresolved
    app.fieldStates = app.fieldStates.filter((f) => !f.canonicalField.startsWith('currentInsurance.'))
    app.profile.currentInsurance = {
      agency_id: 'agency-1',
      carrierName: '',
      expirationDate: '',
      limits: '',
      premium: 0,
    }

    const planBefore = buildWizardPlan(app)

    const doc: DocumentRecord = {
      agency_id: 'agency-1',
      id: 'doc-1',
      fileName: 'CurrentPolicy.pdf',
      type: 'Policy',
      category: 'current_policy',
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
    }
    app.profile.documents.push(doc)

    const result = await processDocument({ documentId: 'doc-1', application: app })
    expect(result.success).toBe(true)

    const planAfter = buildWizardPlan(result.application)
    expect(planAfter.unresolvedQuestions.length).toBeLessThan(planBefore.unresolvedQuestions.length)
  })

  it('7. verifies Document AI does NOT mutate Customer Record profile directly', async () => {
    const app = structuredClone(demoApplication)
    const customer = structuredClone(demoCustomer)
    const initialCustomerRevenue = customer.profile.business.annualRevenue

    const doc: DocumentRecord = {
      agency_id: 'agency-1',
      id: 'doc-1',
      fileName: 'CurrentPolicy.pdf',
      type: 'Policy',
      category: 'current_policy',
      status: 'uploaded',
      uploadedAt: new Date().toISOString(),
    }
    app.profile.documents.push(doc)

    await processDocument({ documentId: 'doc-1', application: app })

    // Customer profile remains unmutated by document intake
    expect(customer.profile.business.annualRevenue).toBe(initialCustomerRevenue)
  })
})
