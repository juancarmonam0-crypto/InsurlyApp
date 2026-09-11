import type { AcordPreview, ApplicationRecord, FieldValue, MappingDefinition, MappingRow, ReadinessResult } from '../../../domain/types'
import { getApplicationDefinition } from '../../../domain/applicationDefinitions'
import { getFieldValue, hasMeaningfulValue } from '../../../services/application/fieldAccess'
import { calculateReadiness } from '../../../services/application/readinessEngine'

const formatValue = (value: FieldValue) => {
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) return value.join(', ')
  return value
}

const mappingDefinitions: MappingDefinition[] = [
  {
    canonicalField: 'business.legalName',
    displayLabel: 'Applicant Legal Name',
    targetField: 'ACORD125.Applicant.LegalName',
  },
  {
    canonicalField: 'business.dba',
    displayLabel: 'DBA / Operating Name',
    targetField: 'ACORD125.Applicant.DBAName',
  },
  {
    canonicalField: 'business.entityType',
    displayLabel: 'Entity Type',
    targetField: 'ACORD125.Applicant.EntityType',
  },
  {
    canonicalField: 'business.fein',
    displayLabel: 'Federal Tax ID (FEIN)',
    targetField: 'ACORD125.Applicant.FEIN',
  },
  {
    canonicalField: 'business.stateOfFormation',
    displayLabel: 'State of Formation',
    targetField: 'ACORD125.Applicant.StateOfFormation',
  },
  {
    canonicalField: 'person.fullName',
    displayLabel: 'Primary Contact Name',
    targetField: 'ACORD125.Applicant.ContactName',
  },
  {
    canonicalField: 'location.addressLine1',
    displayLabel: 'Premises Address',
    targetField: 'ACORD125.Location.AddressLine1',
  },
  {
    canonicalField: 'business.annualRevenue',
    displayLabel: 'Annual Revenue / Gross Receipts',
    targetField: 'ACORD125.Business.AnnualRevenue',
    transform: (value) => typeof value === 'number' ? `$${value.toLocaleString()}` : formatValue(value),
  },
  {
    canonicalField: 'business.naicsCode',
    displayLabel: 'NAICS Classification',
    targetField: 'ACORD125.Business.NAICSCode',
  },
  {
    canonicalField: 'business.employeeCount',
    displayLabel: 'Number of Employees',
    targetField: 'ACORD125.Business.EmployeeCount',
  },
  {
    canonicalField: 'business.yearsInBusiness',
    displayLabel: 'Years in Business',
    targetField: 'ACORD125.Business.YearsInBusiness',
  },
  {
    canonicalField: 'currentInsurance.carrierName',
    displayLabel: 'Prior / Current Carrier',
    targetField: 'ACORD125.PriorCoverage.CarrierName',
  },
  {
    canonicalField: 'currentInsurance.limits',
    displayLabel: 'General Liability Limits',
    targetField: 'ACORD125.Coverage.Limits',
  },
  {
    canonicalField: 'application.desiredEffectiveDate',
    displayLabel: 'Proposed Effective Date',
    targetField: 'ACORD125.Policy.ProposedEffectiveDate',
  },
  {
    canonicalField: 'loss.description',
    displayLabel: 'Prior Loss History Summary',
    targetField: 'ACORD125.LossHistory.Summary',
  },
  {
    canonicalField: 'gl.subcontractorUsage',
    displayLabel: 'Subcontractor Operations Flag',
    targetField: 'ACORD125.Remarks.SubcontractorUsage',
    transform: (value) => (value === true ? 'Yes' : value === false ? 'No' : 'Unspecified'),
  },
  {
    canonicalField: 'gl.residentialCommercialMix',
    displayLabel: 'Operations Mix (Res / Comm)',
    targetField: 'ACORD125.Remarks.OperationsMix',
  },
]

const buildMappingRow = (
  application: ApplicationRecord,
  mapping: MappingDefinition,
  readiness: ReadinessResult,
): MappingRow => {
  const value = getFieldValue(application, mapping.canonicalField)
  const hasConflict = application.conflicts.some((conflict) => conflict.canonicalField === mapping.canonicalField && conflict.status !== 'resolved')
  const pendingReview = readiness.missingConfirmations.some((item) => item.requirement.canonicalField === mapping.canonicalField)
    || readiness.missingBrokerVerifications.some((item) => item.requirement.canonicalField === mapping.canonicalField)

  if (!hasMeaningfulValue(value)) {
    return {
      acordField: mapping.displayLabel,
      canonicalField: mapping.canonicalField,
      value: 'Missing',
      status: 'missing',
      note: `${mapping.targetField} is not yet populated from the canonical application state.`,
    }
  }

  if (hasConflict || pendingReview) {
    return {
      acordField: mapping.displayLabel,
      canonicalField: mapping.canonicalField,
      value: mapping.transform ? mapping.transform(value as FieldValue) : formatValue(value as FieldValue),
      status: 'review_required',
      note: `${mapping.targetField} maps from canonical application state but still needs review.`,
    }
  }

  return {
    acordField: mapping.displayLabel,
    canonicalField: mapping.canonicalField,
    value: mapping.transform ? mapping.transform(value as FieldValue) : formatValue(value as FieldValue),
    status: 'mapped',
    note: `${mapping.targetField} maps from canonical application state.`,
  }
}

export const buildAcord125Preview = (application: ApplicationRecord): AcordPreview => {
  const definition = getApplicationDefinition(application.definitionId, application.definitionVersion)
  const readiness = calculateReadiness(application, definition)
  const rows = mappingDefinitions.map((mapping) => buildMappingRow(application, mapping, readiness))
  const mappedCount = rows.filter((row) => row.status === 'mapped').length
  const missingCount = rows.filter((row) => row.status === 'missing').length
  const reviewRequiredCount = rows.filter((row) => row.status === 'review_required').length

  return {
    status: application.generatedAt ? 'Generated' : 'Ready for preview',
    mappedCount,
    missingCount,
    reviewRequiredCount,
    rows,
    generatedPreview: application.generatedAt
      ? `ACORD 125 representation generated for ${application.profile.business.legalName} on ${new Date(application.generatedAt).toLocaleString()}.`
      : 'Generate Application to refresh the ACORD 125 mapping preview.',
  }
}

export const acord125_2016_03_Adapter = {
  id: 'acord-125:2016-03',
  formType: 'ACORD 125',
  edition: '2016/03',
  lineOfBusiness: 'Commercial Insurance',
  description: 'ACORD 125 Commercial Insurance Application (Standard Edition 03/2016)',
  mappings: mappingDefinitions,
  buildPreview: buildAcord125Preview,
}

// 2014-12 edition mapping variant
const mappingDefinitions2014: MappingDefinition[] = mappingDefinitions.map((m) => {
  if (m.canonicalField === 'application.desiredEffectiveDate') {
    return {
      ...m,
      targetField: 'ACORD125_2014.Policy.EffectiveDate',
    }
  }
  return m
})

export const acord125_2014_12_Adapter = {
  id: 'acord-125:2014-12',
  formType: 'ACORD 125',
  edition: '2014/12',
  lineOfBusiness: 'Commercial Insurance',
  description: 'ACORD 125 Commercial Insurance Application (Legacy Edition 12/2014)',
  mappings: mappingDefinitions2014,
  buildPreview: (application: ApplicationRecord): AcordPreview => {
    const definition = getApplicationDefinition(application.definitionId, application.definitionVersion)
    const readiness = calculateReadiness(application, definition)
    const rows = mappingDefinitions2014.map((mapping) => buildMappingRow(application, mapping, readiness))
    const mappedCount = rows.filter((row) => row.status === 'mapped').length
    const missingCount = rows.filter((row) => row.status === 'missing').length
    const reviewRequiredCount = rows.filter((row) => row.status === 'review_required').length

    return {
      status: application.generatedAt ? 'Generated' : 'Ready for preview',
      mappedCount,
      missingCount,
      reviewRequiredCount,
      rows,
      generatedPreview: application.generatedAt
        ? `ACORD 125 (2014/12) representation generated for ${application.profile.business.legalName} on ${new Date(application.generatedAt).toLocaleString()}.`
        : 'Generate Application to refresh the ACORD 125 (2014/12) mapping preview.',
    }
  },
}

