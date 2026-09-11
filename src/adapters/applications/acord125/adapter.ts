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
    canonicalField: 'business.entityType',
    displayLabel: 'Entity Type',
    targetField: 'ACORD125.Applicant.EntityType',
  },
  {
    canonicalField: 'business.stateOfFormation',
    displayLabel: 'State of Formation',
    targetField: 'ACORD125.Applicant.StateOfFormation',
  },
  {
    canonicalField: 'business.annualRevenue',
    displayLabel: 'Annual Revenue',
    targetField: 'ACORD125.Business.AnnualRevenue',
    transform: (value) => typeof value === 'number' ? `$${value.toLocaleString()}` : formatValue(value),
  },
  {
    canonicalField: 'business.naicsCode',
    displayLabel: 'NAICS',
    targetField: 'ACORD125.Business.NAICSCode',
  },
  {
    canonicalField: 'business.employeeCount',
    displayLabel: 'Number of Employees',
    targetField: 'ACORD125.Business.EmployeeCount',
  },
  {
    canonicalField: 'business.fein',
    displayLabel: 'FEIN',
    targetField: 'ACORD125.Business.FEIN',
  },
  {
    canonicalField: 'currentInsurance.effectiveDate',
    displayLabel: 'Desired Effective Date',
    targetField: 'ACORD125.Policy.DesiredEffectiveDate',
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
