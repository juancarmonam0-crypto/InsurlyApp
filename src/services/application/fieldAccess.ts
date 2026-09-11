import type { ApplicationRecord, FieldValue } from '../../domain/types'

interface FieldAccessor {
  get: (application: ApplicationRecord) => FieldValue | undefined
  set: (application: ApplicationRecord, value: FieldValue) => ApplicationRecord
}

const accessors: Record<string, FieldAccessor> = {
  'business.legalName': {
    get: (application) => application.profile.business.legalName,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, legalName: value } } }
      : application,
  },
  'business.entityType': {
    get: (application) => application.profile.business.entityType,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, entityType: value } } }
      : application,
  },
  'business.stateOfFormation': {
    get: (application) => application.profile.business.stateOfFormation,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, stateOfFormation: value } } }
      : application,
  },
  'business.annualRevenue': {
    get: (application) => application.profile.business.annualRevenue,
    set: (application, value) => typeof value === 'number'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, annualRevenue: value } } }
      : application,
  },
  'business.naicsCode': {
    get: (application) => application.profile.business.naicsCode,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, naicsCode: value } } }
      : application,
  },
  'business.employeeCount': {
    get: (application) => application.profile.business.employeeCount,
    set: (application, value) => typeof value === 'number'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, employeeCount: value } } }
      : application,
  },
  'business.yearsInBusiness': {
    get: (application) => application.profile.business.yearsInBusiness,
    set: (application, value) => typeof value === 'number'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, yearsInBusiness: value } } }
      : application,
  },
  'business.fein': {
    get: (application) => application.profile.business.fein,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, fein: value } } }
      : application,
  },
  'business.description': {
    get: (application) => application.profile.business.description,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, description: value } } }
      : application,
  },
  'currentInsurance.carrierName': {
    get: (application) => application.profile.currentInsurance.carrierName,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, currentInsurance: { ...application.profile.currentInsurance, carrierName: value } } }
      : application,
  },
  'currentInsurance.effectiveDate': {
    get: (application) => application.profile.currentInsurance.effectiveDate,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, currentInsurance: { ...application.profile.currentInsurance, effectiveDate: value } } }
      : application,
  },
}

export const getSupportedCanonicalFields = () => Object.keys(accessors)

export const getFieldValue = (application: ApplicationRecord, canonicalField: string) => accessors[canonicalField]?.get(application)

export const setFieldValue = (application: ApplicationRecord, canonicalField: string, value: FieldValue) => accessors[canonicalField]?.set(application, value) ?? application

export const hasMeaningfulValue = (value: FieldValue | undefined) => {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}
