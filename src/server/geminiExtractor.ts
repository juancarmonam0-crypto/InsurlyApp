import { GoogleGenAI, Type } from '@google/genai'
import type { DocumentCategory, DocumentExtractionResult, ExtractedCandidateFact } from '../domain/types'

export interface ExtractDocumentPayload {
  documentId: string
  fileName: string
  mimeType: string
  fileBase64: string
  categoryHint?: string
}

let aiClient: GoogleGenAI | null = null

export const getGenAIClient = (): GoogleGenAI => {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required on the server')
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  }
  return aiClient
}

const SYSTEM_INSTRUCTION = `You are Insurly's AI Commercial Insurance Document Intelligence Engine.
Analyze the provided insurance document, classify it, and extract structured candidate facts with high precision.

Document categories:
- 'current_policy': Insurance policy declaration, certificate of insurance, carrier details, policy periods, coverage limits, rating bases.
- 'prior_acord_application': ACORD 125, ACORD 126, commercial application documents with business, location, or applicant info.
- 'loss_runs': Historical claim loss runs report, loss dates, claim amounts, causes/descriptions, and statuses.
- 'vehicle_schedule': Scheduled commercial auto lists with year, make, model, VIN, and usage.
- 'business_document': Articles of organization/incorporation, state filing certificates, W9, tax registration.
- 'unknown': Unrecognized or unrelated document.

Canonical Fields:
- business.legalName (string)
- business.dba (string)
- business.entityType (string: 'LLC', 'Corporation', 'Sole Proprietorship', 'Partnership', etc.)
- business.stateOfFormation (string: 2-letter state code or name)
- business.annualRevenue (number: digits only, e.g. 300000)
- business.naicsCode (string)
- business.employeeCount (number)
- business.yearsInBusiness (number)
- business.fein (string, e.g. '92-1845601')
- business.description (string)
- location.addressLine1 (string)
- location.city (string)
- location.state (string)
- location.postalCode (string)
- location.occupancy (string)
- person.fullName (string)
- person.role (string)
- person.email (string)
- person.phone (string)
- vehicle.year (number)
- vehicle.make (string)
- vehicle.model (string)
- vehicle.vin (string)
- vehicle.usage (string)
- currentInsurance.carrierName (string)
- currentInsurance.effectiveDate (string: YYYY-MM-DD)
- currentInsurance.expirationDate (string: YYYY-MM-DD)
- currentInsurance.limits (string, e.g. '$1,000,000 / $2,000,000')
- currentInsurance.premium (number)
- loss.date (string: YYYY-MM-DD)
- loss.amount (number)
- loss.description (string)
- loss.status (string: 'closed' | 'open')

For every extracted fact, provide:
- id: unique string id (e.g. 'fact-1', 'fact-2')
- rawLabel: label as it appeared in the document (e.g. 'Insurer Name', 'Gross Receipts')
- rawValue: exact text value extracted
- proposedCanonicalField: one of the canonical fields above
- canonicalField: matching canonical field
- entityType: 'business' | 'person' | 'location' | 'vehicle' | 'policy' | 'loss'
- normalizedValue: normalized value (e.g. integer 300000 for '$300,000')
- confidence: number between 0.0 and 1.0 based on clarity and certainty
- page: 1-based page number if available (default 1)
- evidenceText: quote or snippet of surrounding text in the document proving the fact
- extractionMethod: 'gemini_multimodal'
- status: 'valid' | 'invalid' | 'review_required' | 'unmapped'`

export const extractDocumentWithGemini = async (
  payload: ExtractDocumentPayload,
): Promise<DocumentExtractionResult> => {
  const { documentId, fileName, mimeType, fileBase64, categoryHint } = payload
  const ai = getGenAIClient()

  // Standardize MIME type for Gemini
  let effectiveMime = mimeType
  if (effectiveMime.includes('pdf')) effectiveMime = 'application/pdf'
  else if (effectiveMime.includes('png')) effectiveMime = 'image/png'
  else if (effectiveMime.includes('jpeg') || effectiveMime.includes('jpg')) effectiveMime = 'image/jpeg'
  else if (effectiveMime.includes('webp')) effectiveMime = 'image/webp'
  else effectiveMime = 'application/pdf'

  const prompt = `Classify this document (filename: "${fileName}"${categoryHint ? `, hint: ${categoryHint}` : ''}) and extract all commercial insurance candidate facts according to instructions.`

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: effectiveMime,
              data: fileBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: {
            type: Type.STRING,
            description: "Category: 'current_policy', 'prior_acord_application', 'loss_runs', 'vehicle_schedule', 'business_document', or 'unknown'",
          },
          classificationConfidence: {
            type: Type.NUMBER,
            description: 'Confidence between 0 and 1 for document classification',
          },
          fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                rawLabel: { type: Type.STRING },
                rawValue: { type: Type.STRING },
                proposedCanonicalField: { type: Type.STRING },
                canonicalField: { type: Type.STRING },
                entityType: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                page: { type: Type.INTEGER },
                evidenceText: { type: Type.STRING },
                extractionMethod: { type: Type.STRING },
                status: { type: Type.STRING },
              },
              required: ['id', 'rawLabel', 'rawValue', 'proposedCanonicalField', 'canonicalField', 'entityType', 'confidence'],
            },
          },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ['documentType', 'classificationConfidence', 'fields'],
      },
    },
  })

  const text = response.text?.trim() || '{}'
  let parsed: any = {}
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', text, err)
    throw new Error('Gemini model output could not be parsed as JSON')
  }

  const documentType: DocumentCategory = (parsed.documentType as DocumentCategory) || 'unknown'
  const classificationConfidence = typeof parsed.classificationConfidence === 'number' ? parsed.classificationConfidence : 0.85

  const fields: ExtractedCandidateFact[] = (parsed.fields || []).map((f: any, idx: number) => {
    let normalizedVal: any = f.rawValue
    // Auto-normalize numbers if relevant
    if (
      f.canonicalField === 'business.annualRevenue' ||
      f.canonicalField === 'business.employeeCount' ||
      f.canonicalField === 'business.yearsInBusiness' ||
      f.canonicalField === 'currentInsurance.premium' ||
      f.canonicalField === 'loss.amount' ||
      f.canonicalField === 'vehicle.year'
    ) {
      const numClean = String(f.rawValue).replace(/[^0-9.-]/g, '')
      const num = Number(numClean)
      if (!isNaN(num)) normalizedVal = num
    }

    return {
      id: f.id || `fact-${documentId}-${idx + 1}`,
      rawLabel: f.rawLabel || 'Unknown Label',
      rawValue: f.rawValue || '',
      proposedCanonicalField: f.proposedCanonicalField || f.canonicalField || 'business.notes',
      canonicalField: f.canonicalField || f.proposedCanonicalField || 'business.notes',
      entityType: (f.entityType as any) || 'business',
      normalizedValue: normalizedVal,
      confidence: typeof f.confidence === 'number' ? Math.max(0, Math.min(1, f.confidence)) : 0.85,
      page: f.page || 1,
      evidenceText: f.evidenceText || '',
      extractionMethod: f.extractionMethod || 'gemini_multimodal',
      status: (f.status as any) || 'valid',
      warnings: [],
    }
  })

  return {
    documentId,
    documentType,
    classificationConfidence,
    fields,
    warnings: parsed.warnings || [],
    providerMetadata: {
      providerName: 'GeminiMultimodalExtractor',
      model: 'gemini-2.5-flash',
      engineVersion: '2.5.0',
    },
  }
}
