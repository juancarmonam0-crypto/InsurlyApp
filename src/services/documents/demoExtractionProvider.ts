import type {
  DocumentCategory,
  DocumentExtractionResult,
  DocumentRecord,
  ExtractedCandidateFact,
} from '../../domain/types'

export interface DocumentExtractionProvider {
  classifyDocument(document: DocumentRecord): Promise<{ category: DocumentCategory; confidence: number }>
  extractDocument(document: DocumentRecord): Promise<DocumentExtractionResult>
}

export class DemoExtractionProvider implements DocumentExtractionProvider {
  async classifyDocument(document: DocumentRecord): Promise<{ category: DocumentCategory; confidence: number }> {
    const fileName = document.fileName.toLowerCase()
    const type = document.type.toLowerCase()

    if (fileName.includes('policy') || type.includes('policy')) {
      return { category: 'current_policy', confidence: 0.98 }
    }
    if (fileName.includes('acord') || type.includes('acord') || fileName.includes('application')) {
      return { category: 'prior_acord_application', confidence: 0.97 }
    }
    if (fileName.includes('loss') || type.includes('loss')) {
      return { category: 'loss_runs', confidence: 0.95 }
    }
    if (fileName.includes('vehicle') || fileName.includes('fleet') || type.includes('vehicle')) {
      return { category: 'vehicle_schedule', confidence: 0.96 }
    }
    if (fileName.includes('business') || fileName.includes('tax') || fileName.includes('license')) {
      return { category: 'business_document', confidence: 0.90 }
    }

    return { category: 'unknown', confidence: 0.50 }
  }

  async extractDocument(document: DocumentRecord): Promise<DocumentExtractionResult> {
    const classification = await this.classifyDocument(document)
    const category = document.category || classification.category
    const fields: ExtractedCandidateFact[] = []

    if (category === 'current_policy') {
      fields.push(
        {
          id: `fact-${document.id}-1`,
          rawLabel: 'Current Insurance Carrier',
          rawValue: 'Travelers Insurance',
          proposedCanonicalField: 'currentInsurance.carrierName',
          canonicalField: 'currentInsurance.carrierName',
          entityType: 'policy',
          normalizedValue: 'Travelers Insurance',
          confidence: 0.96,
          page: 1,
          evidenceText: 'Insurer: Travelers Commercial Lines Policy #TRV-89420-2026',
          extractionMethod: 'rule_based_pdf',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-2`,
          rawLabel: 'Policy Effective Date',
          rawValue: '2026-01-01',
          proposedCanonicalField: 'currentInsurance.effectiveDate',
          canonicalField: 'currentInsurance.effectiveDate',
          entityType: 'policy',
          normalizedValue: '2026-01-01',
          confidence: 0.95,
          page: 1,
          evidenceText: 'Effective Period: 01/01/2026 to 01/01/2027',
          extractionMethod: 'rule_based_pdf',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-3`,
          rawLabel: 'Policy Expiration Date',
          rawValue: '2027-01-01',
          proposedCanonicalField: 'currentInsurance.expirationDate',
          canonicalField: 'currentInsurance.expirationDate',
          entityType: 'policy',
          normalizedValue: '2027-01-01',
          confidence: 0.95,
          page: 1,
          evidenceText: 'Expiration Date: 01/01/2027',
          extractionMethod: 'rule_based_pdf',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-4`,
          rawLabel: 'General Liability Limit',
          rawValue: '$1,000,000 / $2,000,000',
          proposedCanonicalField: 'currentInsurance.limits',
          canonicalField: 'currentInsurance.limits',
          entityType: 'policy',
          normalizedValue: '$1,000,000 / $2,000,000',
          confidence: 0.92,
          page: 1,
          evidenceText: 'Limits of Insurance: Each Occurrence $1,000,000 / General Aggregate $2,000,000',
          extractionMethod: 'rule_based_pdf',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-5`,
          rawLabel: 'Gross Receipts / Annual Revenue',
          rawValue: '$300,000',
          proposedCanonicalField: 'business.annualRevenue',
          canonicalField: 'business.annualRevenue',
          entityType: 'business',
          normalizedValue: 300000,
          confidence: 0.94,
          page: 2,
          evidenceText: 'Rating Basis: Gross Annual Receipts $300,000',
          extractionMethod: 'rule_based_pdf',
          status: 'valid',
        },
      )
    } else if (category === 'prior_acord_application') {
      fields.push(
        {
          id: `fact-${document.id}-1`,
          rawLabel: 'Applicant Legal Name',
          rawValue: 'Cedar Ridge Services LLC',
          proposedCanonicalField: 'business.legalName',
          canonicalField: 'business.legalName',
          entityType: 'business',
          normalizedValue: 'Cedar Ridge Services LLC',
          confidence: 0.98,
          page: 1,
          evidenceText: 'APPLICANT NAME: Cedar Ridge Services LLC',
          extractionMethod: 'acord_ocr',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-2`,
          rawLabel: 'DBA / Operating Name',
          rawValue: 'Cedar Ridge Landscaping',
          proposedCanonicalField: 'business.dba',
          canonicalField: 'business.dba',
          entityType: 'business',
          normalizedValue: 'Cedar Ridge Landscaping',
          confidence: 0.95,
          page: 1,
          evidenceText: 'DBA: Cedar Ridge Landscaping',
          extractionMethod: 'acord_ocr',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-3`,
          rawLabel: 'Federal Employer ID',
          rawValue: '92-1845601',
          proposedCanonicalField: 'business.fein',
          canonicalField: 'business.fein',
          entityType: 'business',
          normalizedValue: '92-1845601',
          confidence: 0.97,
          page: 1,
          evidenceText: 'FEIN: 92-1845601',
          extractionMethod: 'acord_ocr',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-4`,
          rawLabel: 'Years in Business',
          rawValue: '6',
          proposedCanonicalField: 'business.yearsInBusiness',
          canonicalField: 'business.yearsInBusiness',
          entityType: 'business',
          normalizedValue: 6,
          confidence: 0.91,
          page: 1,
          evidenceText: 'YEARS IN BUS: 6',
          extractionMethod: 'acord_ocr',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-5`,
          rawLabel: 'Mailing Address Line 1',
          rawValue: '1042 Industrial Parkway',
          proposedCanonicalField: 'location.addressLine1',
          canonicalField: 'location.addressLine1',
          entityType: 'location',
          normalizedValue: '1042 Industrial Parkway',
          confidence: 0.96,
          page: 1,
          evidenceText: 'STREET: 1042 Industrial Parkway',
          extractionMethod: 'acord_ocr',
          status: 'valid',
        },
      )
    } else if (category === 'loss_runs') {
      fields.push(
        {
          id: `fact-${document.id}-1`,
          rawLabel: 'Date of Loss',
          rawValue: '2024-05-12',
          proposedCanonicalField: 'loss.date',
          canonicalField: 'loss.date',
          entityType: 'loss',
          normalizedValue: '2024-05-12',
          confidence: 0.91,
          page: 1,
          evidenceText: 'CLAIM #CL-9021 DATE OF LOSS: 05/12/2024',
          extractionMethod: 'table_parser',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-2`,
          rawLabel: 'Loss Incurred Amount',
          rawValue: '$2,400',
          proposedCanonicalField: 'loss.amount',
          canonicalField: 'loss.amount',
          entityType: 'loss',
          normalizedValue: 2400,
          confidence: 0.92,
          page: 1,
          evidenceText: 'TOTAL INCURRED: $2,400.00',
          extractionMethod: 'table_parser',
          status: 'valid',
        },
      )
    } else if (category === 'vehicle_schedule') {
      fields.push(
        {
          id: `fact-${document.id}-1`,
          rawLabel: 'Vehicle Year',
          rawValue: '2022',
          proposedCanonicalField: 'vehicle.year',
          canonicalField: 'vehicle.year',
          entityType: 'vehicle',
          normalizedValue: 2022,
          confidence: 0.95,
          page: 1,
          evidenceText: 'VEH #1 YEAR: 2022',
          extractionMethod: 'spreadsheet_parser',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-2`,
          rawLabel: 'Vehicle Make',
          rawValue: 'Ford',
          proposedCanonicalField: 'vehicle.make',
          canonicalField: 'vehicle.make',
          entityType: 'vehicle',
          normalizedValue: 'Ford',
          confidence: 0.96,
          page: 1,
          evidenceText: 'MAKE: FORD',
          extractionMethod: 'spreadsheet_parser',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-3`,
          rawLabel: 'Vehicle Model',
          rawValue: 'F-250 Super Duty',
          proposedCanonicalField: 'vehicle.model',
          canonicalField: 'vehicle.model',
          entityType: 'vehicle',
          normalizedValue: 'F-250 Super Duty',
          confidence: 0.95,
          page: 1,
          evidenceText: 'MODEL: F-250 SUPER DUTY',
          extractionMethod: 'spreadsheet_parser',
          status: 'valid',
        },
        {
          id: `fact-${document.id}-4`,
          rawLabel: 'VIN',
          rawValue: '1FT8X2BT5MED12049',
          proposedCanonicalField: 'vehicle.vin',
          canonicalField: 'vehicle.vin',
          entityType: 'vehicle',
          normalizedValue: '1FT8X2BT5MED12049',
          confidence: 0.98,
          page: 1,
          evidenceText: 'VIN: 1FT8X2BT5MED12049',
          extractionMethod: 'spreadsheet_parser',
          status: 'valid',
        },
      )
    } else {
      // Fallback/unknown
      fields.push({
        id: `fact-${document.id}-1`,
        rawLabel: 'Custom Business Note',
        rawValue: 'Special operations permit included',
        proposedCanonicalField: 'business.notes',
        canonicalField: 'business.notes',
        entityType: 'business',
        normalizedValue: 'Special operations permit included',
        confidence: 0.65,
        page: 1,
        evidenceText: 'Note: Special operations permit included',
        extractionMethod: 'heuristic',
        status: 'unmapped',
      })
    }

    return {
      documentId: document.id,
      documentType: category,
      classificationConfidence: classification.confidence,
      fields,
      warnings: category === 'unknown' ? ['Unrecognized document category'] : [],
      providerMetadata: {
        providerName: 'DemoExtractionProvider',
        engineVersion: '1.0.0-deterministic',
      },
    }
  }
}
