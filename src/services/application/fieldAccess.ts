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
  'business.dba': {
    get: (application) => application.profile.business.dba,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, dba: value } } }
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
  'currentInsurance.expirationDate': {
    get: (application) => application.profile.currentInsurance.expirationDate,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, currentInsurance: { ...application.profile.currentInsurance, expirationDate: value } } }
      : application,
  },
  'currentInsurance.limits': {
    get: (application) => application.profile.currentInsurance.limits,
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, currentInsurance: { ...application.profile.currentInsurance, limits: value } } }
      : application,
  },
  'currentInsurance.premium': {
    get: (application) => application.profile.currentInsurance.premium,
    set: (application, value) => typeof value === 'number'
      ? { ...application, profile: { ...application.profile, currentInsurance: { ...application.profile.currentInsurance, premium: value } } }
      : application,
  },
  'gl.subcontractorUsage': {
    get: (application) => {
      const fs = application.fieldStates.find((f) => f.canonicalField === 'gl.subcontractorUsage')
      return fs?.selectedValue
    },
    set: (application, _value) => application,
  },
  'gl.subcontractorPercent': {
    get: (application) => {
      const fs = application.fieldStates.find((f) => f.canonicalField === 'gl.subcontractorPercent')
      return fs?.selectedValue
    },
    set: (application, _value) => application,
  },
  'gl.residentialCommercialMix': {
    get: (application) => {
      const fs = application.fieldStates.find((f) => f.canonicalField === 'gl.residentialCommercialMix')
      return fs?.selectedValue
    },
    set: (application, _value) => application,
  },
  'gl.operationsDescription': {
    get: (application) => {
      const fs = application.fieldStates.find((f) => f.canonicalField === 'gl.operationsDescription')
      return fs?.selectedValue ?? application.profile.business.description
    },
    set: (application, value) => typeof value === 'string'
      ? { ...application, profile: { ...application.profile, business: { ...application.profile.business, description: value } } }
      : application,
  },
  'loss.description': {
    get: (application) => application.profile.lossHistory[0]?.description,
    set: (application, value) => typeof value === 'string' && application.profile.lossHistory[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            lossHistory: [{ ...application.profile.lossHistory[0], description: value }, ...application.profile.lossHistory.slice(1)],
          },
        }
      : application,
  },
  'loss.amount': {
    get: (application) => application.profile.lossHistory[0]?.amount,
    set: (application, value) => typeof value === 'number' && application.profile.lossHistory[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            lossHistory: [{ ...application.profile.lossHistory[0], amount: value }, ...application.profile.lossHistory.slice(1)],
          },
        }
      : application,
  },
  'loss.date': {
    get: (application) => application.profile.lossHistory[0]?.date,
    set: (application, value) => typeof value === 'string' && application.profile.lossHistory[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            lossHistory: [{ ...application.profile.lossHistory[0], date: value }, ...application.profile.lossHistory.slice(1)],
          },
        }
      : application,
  },
  'application.desiredEffectiveDate': {
    get: (application) => {
      const fs = application.fieldStates.find((f) => f.canonicalField === 'application.desiredEffectiveDate')
      if (fs?.selectedValue !== undefined) return fs.selectedValue
      return application.profile.currentInsurance.effectiveDate
    },
    set: (application, value) => {
      if (typeof value === 'string') {
        const existingIndex = application.fieldStates.findIndex((f) => f.canonicalField === 'application.desiredEffectiveDate')
        const updatedFieldStates = [...application.fieldStates]
        if (existingIndex >= 0) {
          updatedFieldStates[existingIndex] = { ...updatedFieldStates[existingIndex], selectedValue: value }
        } else {
          updatedFieldStates.push({
            canonicalField: 'application.desiredEffectiveDate',
            selectedValue: value,
            customerConfirmed: false,
            brokerVerified: false,
            updatedAt: new Date().toISOString(),
          })
        }
        return { ...application, fieldStates: updatedFieldStates }
      }
      return application
    },
  },
  'vehicle.year': {
    get: (application) => application.profile.vehicles[0]?.year,
    set: (application, value) => typeof value === 'number' && application.profile.vehicles[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            vehicles: [{ ...application.profile.vehicles[0], year: value }, ...application.profile.vehicles.slice(1)],
          },
        }
      : application,
  },
  'vehicle.make': {
    get: (application) => application.profile.vehicles[0]?.make,
    set: (application, value) => typeof value === 'string' && application.profile.vehicles[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            vehicles: [{ ...application.profile.vehicles[0], make: value }, ...application.profile.vehicles.slice(1)],
          },
        }
      : application,
  },
  'vehicle.model': {
    get: (application) => application.profile.vehicles[0]?.model,
    set: (application, value) => typeof value === 'string' && application.profile.vehicles[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            vehicles: [{ ...application.profile.vehicles[0], model: value }, ...application.profile.vehicles.slice(1)],
          },
        }
      : application,
  },
  'vehicle.vin': {
    get: (application) => application.profile.vehicles[0]?.vin,
    set: (application, value) => typeof value === 'string' && application.profile.vehicles[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            vehicles: [{ ...application.profile.vehicles[0], vin: value }, ...application.profile.vehicles.slice(1)],
          },
        }
      : application,
  },
  'person.fullName': {
    get: (application) => application.profile.people[0]?.fullName,
    set: (application, value) => typeof value === 'string' && application.profile.people[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            people: [{ ...application.profile.people[0], fullName: value }, ...application.profile.people.slice(1)],
          },
        }
      : application,
  },
  'location.addressLine1': {
    get: (application) => application.profile.locations[0]?.addressLine1,
    set: (application, value) => typeof value === 'string' && application.profile.locations[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            locations: [{ ...application.profile.locations[0], addressLine1: value }, ...application.profile.locations.slice(1)],
          },
        }
      : application,
  },
  'location.city': {
    get: (application) => application.profile.locations[0]?.city,
    set: (application, value) => typeof value === 'string' && application.profile.locations[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            locations: [{ ...application.profile.locations[0], city: value }, ...application.profile.locations.slice(1)],
          },
        }
      : application,
  },
  'location.state': {
    get: (application) => application.profile.locations[0]?.state,
    set: (application, value) => typeof value === 'string' && application.profile.locations[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            locations: [{ ...application.profile.locations[0], state: value }, ...application.profile.locations.slice(1)],
          },
        }
      : application,
  },
  'location.postalCode': {
    get: (application) => application.profile.locations[0]?.postalCode,
    set: (application, value) => typeof value === 'string' && application.profile.locations[0]
      ? {
          ...application,
          profile: {
            ...application.profile,
            locations: [{ ...application.profile.locations[0], postalCode: value }, ...application.profile.locations.slice(1)],
          },
        }
      : application,
  },
}

export const getSupportedCanonicalFields = () => Object.keys(accessors)

export const getFieldValue = (application: ApplicationRecord, canonicalField: string): FieldValue | undefined => {
  const fieldState = application.fieldStates.find((fs) => fs.canonicalField === canonicalField)
  if (fieldState?.selectedValue !== undefined) return fieldState.selectedValue

  return accessors[canonicalField]?.get(application)
}

export const setFieldValue = (application: ApplicationRecord, canonicalField: string, value: FieldValue): ApplicationRecord => {
  let updatedApp = accessors[canonicalField]?.set(application, value) ?? application

  const existingFsIndex = updatedApp.fieldStates.findIndex((fs) => fs.canonicalField === canonicalField)
  const updatedFieldStates = [...updatedApp.fieldStates]
  if (existingFsIndex >= 0) {
    updatedFieldStates[existingFsIndex] = {
      ...updatedFieldStates[existingFsIndex],
      selectedValue: value,
      updatedAt: new Date().toISOString(),
    }
  } else {
    updatedFieldStates.push({
      canonicalField,
      selectedValue: value,
      customerConfirmed: false,
      brokerVerified: false,
      updatedAt: new Date().toISOString(),
    })
  }

  return { ...updatedApp, fieldStates: updatedFieldStates }
}

export const hasMeaningfulValue = (value: FieldValue | undefined) => {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}
