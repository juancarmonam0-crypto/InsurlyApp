import type { FieldValue, ProfileEntityKind } from './types'

export interface CanonicalFieldDefinition {
  key: string
  entityType: ProfileEntityKind
  fieldPath: string
  valueType: 'string' | 'number' | 'boolean' | 'date' | 'currency'
  label: string
  aliases?: string[]
  validation?: {
    min?: number
    max?: number
    pattern?: string
  }
}

export const CANONICAL_FIELD_REGISTRY: CanonicalFieldDefinition[] = [
  // Customer entity
  { key: 'customer.displayName', entityType: 'customer', fieldPath: 'displayName', valueType: 'string', label: 'Customer Name', aliases: ['customer.display_name', 'customer_name'] },
  { key: 'customer.email', entityType: 'customer', fieldPath: 'email', valueType: 'string', label: 'Customer Email', aliases: ['email'] },
  { key: 'customer.phone', entityType: 'customer', fieldPath: 'phone', valueType: 'string', label: 'Customer Phone', aliases: ['phone'] },

  // Business entity
  { key: 'business.legalName', entityType: 'business', fieldPath: 'legalName', valueType: 'string', label: 'Legal Business Name', aliases: ['business.legal_name', 'legal_name'] },
  { key: 'business.dba', entityType: 'business', fieldPath: 'dba', valueType: 'string', label: 'DBA / Operating Name', aliases: ['business.dba_name', 'dba'] },
  { key: 'business.entityType', entityType: 'business', fieldPath: 'entityType', valueType: 'string', label: 'Entity Type', aliases: ['business.entity_type', 'entity_type'] },
  { key: 'business.stateOfFormation', entityType: 'business', fieldPath: 'stateOfFormation', valueType: 'string', label: 'State of Formation', aliases: ['business.state_of_formation', 'state_of_formation'] },
  { key: 'business.annualRevenue', entityType: 'business', fieldPath: 'annualRevenue', valueType: 'currency', label: 'Annual Revenue', aliases: ['business.annual_revenue', 'annual_revenue', 'gross_receipts', 'projected_sales'], validation: { min: 0 } },
  { key: 'business.naicsCode', entityType: 'business', fieldPath: 'naicsCode', valueType: 'string', label: 'NAICS Code', aliases: ['business.naics_code', 'naics_code'] },
  { key: 'business.employeeCount', entityType: 'business', fieldPath: 'employeeCount', valueType: 'number', label: 'Number of Employees', aliases: ['business.employee_count', 'employee_count', 'employees'], validation: { min: 1 } },
  { key: 'business.yearsInBusiness', entityType: 'business', fieldPath: 'yearsInBusiness', valueType: 'number', label: 'Years in Business', aliases: ['business.years_in_business', 'years_in_business'], validation: { min: 0 } },
  { key: 'business.fein', entityType: 'business', fieldPath: 'fein', valueType: 'string', label: 'Federal Tax ID (FEIN)', aliases: ['fein', 'ein', 'tax_id'] },
  { key: 'business.description', entityType: 'business', fieldPath: 'description', valueType: 'string', label: 'Business Description', aliases: ['description', 'operations_description'] },

  // Person entity
  { key: 'person.firstName', entityType: 'person', fieldPath: 'firstName', valueType: 'string', label: 'First Name', aliases: ['person.first_name', 'first_name'] },
  { key: 'person.lastName', entityType: 'person', fieldPath: 'lastName', valueType: 'string', label: 'Last Name', aliases: ['person.last_name', 'last_name'] },
  { key: 'person.dob', entityType: 'person', fieldPath: 'dob', valueType: 'date', label: 'Date of Birth', aliases: ['dob', 'date_of_birth'] },
  { key: 'person.role', entityType: 'person', fieldPath: 'role', valueType: 'string', label: 'Role / Title', aliases: ['role', 'title'] },
  { key: 'person.email', entityType: 'person', fieldPath: 'email', valueType: 'string', label: 'Email Address', aliases: ['person_email'] },
  { key: 'person.phone', entityType: 'person', fieldPath: 'phone', valueType: 'string', label: 'Phone Number', aliases: ['person_phone'] },

  // Location entity
  { key: 'location.addressLine1', entityType: 'location', fieldPath: 'addressLine1', valueType: 'string', label: 'Street Address', aliases: ['location.address_line_1', 'address_line_1', 'street_address'] },
  { key: 'location.city', entityType: 'location', fieldPath: 'city', valueType: 'string', label: 'City', aliases: ['city'] },
  { key: 'location.state', entityType: 'location', fieldPath: 'state', valueType: 'string', label: 'State', aliases: ['state'] },
  { key: 'location.postalCode', entityType: 'location', fieldPath: 'postalCode', valueType: 'string', label: 'Postal Code', aliases: ['location.postal_code', 'postal_code', 'zip_code'] },
  { key: 'location.occupancy', entityType: 'location', fieldPath: 'occupancy', valueType: 'string', label: 'Building Occupancy / Description', aliases: ['occupancy'] },

  // Vehicle entity
  { key: 'vehicle.year', entityType: 'vehicle', fieldPath: 'year', valueType: 'number', label: 'Vehicle Year', aliases: ['year'] },
  { key: 'vehicle.make', entityType: 'vehicle', fieldPath: 'make', valueType: 'string', label: 'Vehicle Make', aliases: ['make'] },
  { key: 'vehicle.model', entityType: 'vehicle', fieldPath: 'model', valueType: 'string', label: 'Vehicle Model', aliases: ['model'] },
  { key: 'vehicle.vin', entityType: 'vehicle', fieldPath: 'vin', valueType: 'string', label: 'VIN', aliases: ['vin'] },
  { key: 'vehicle.usage', entityType: 'vehicle', fieldPath: 'usage', valueType: 'string', label: 'Vehicle Usage', aliases: ['usage'] },

  // Policy entity
  { key: 'currentInsurance.carrierName', entityType: 'policy', fieldPath: 'carrierName', valueType: 'string', label: 'Current Insurance Carrier', aliases: ['policy.carrier_name', 'carrier_name', 'prior_carrier'] },
  { key: 'currentInsurance.effectiveDate', entityType: 'policy', fieldPath: 'effectiveDate', valueType: 'date', label: 'Desired Effective Date', aliases: ['policy.effective_date', 'effective_date', 'policy_effective_date'] },
  { key: 'currentInsurance.expirationDate', entityType: 'policy', fieldPath: 'expirationDate', valueType: 'date', label: 'Policy Expiration Date', aliases: ['policy.expiration_date', 'expiration_date', 'prior_expiration_date'] },
  { key: 'currentInsurance.limits', entityType: 'policy', fieldPath: 'limits', valueType: 'string', label: 'Coverage Limits', aliases: ['limits'] },
  { key: 'currentInsurance.premium', entityType: 'policy', fieldPath: 'premium', valueType: 'currency', label: 'Current Premium', aliases: ['premium'] },

  // Loss entity
  { key: 'loss.date', entityType: 'loss', fieldPath: 'date', valueType: 'date', label: 'Loss Date', aliases: ['loss.loss_date', 'loss_date'] },
  { key: 'loss.description', entityType: 'loss', fieldPath: 'description', valueType: 'string', label: 'Loss Description', aliases: ['loss_description'] },
  { key: 'loss.amount', entityType: 'loss', fieldPath: 'amount', valueType: 'currency', label: 'Loss Amount', aliases: ['loss_amount'] },
  { key: 'loss.status', entityType: 'loss', fieldPath: 'status', valueType: 'string', label: 'Loss Claim Status', aliases: ['loss_status'] },
]

export const findCanonicalDefinition = (fieldKey: string): CanonicalFieldDefinition | undefined => {
  const directMatch = CANONICAL_FIELD_REGISTRY.find((def) => def.key === fieldKey)
  if (directMatch) return directMatch

  return CANONICAL_FIELD_REGISTRY.find((def) => def.aliases?.includes(fieldKey))
}

export const normalizeCanonicalKey = (fieldKey: string): string => {
  const found = findCanonicalDefinition(fieldKey)
  return found ? found.key : fieldKey
}

export const normalizeCanonicalValue = (fieldKey: string, value: FieldValue): FieldValue => {
  const def = findCanonicalDefinition(fieldKey)
  if (!def) return value

  if (def.valueType === 'number' || def.valueType === 'currency') {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/[^0-9.-]+/g, ''))
      return isNaN(parsed) ? value : parsed
    }
  }

  if (def.valueType === 'boolean') {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim()
      if (lower === 'true' || lower === 'yes') return true
      if (lower === 'false' || lower === 'no') return false
    }
  }

  return value
}
