import type { ApplicationDefinition } from './types'

export const commercialAcord125Definition: ApplicationDefinition = {
  id: 'commercial-acord125',
  lineOfBusiness: 'Commercial Insurance',
  version: 1,
  requirements: [
    {
      id: 'business-legal-name',
      canonicalField: 'business.legalName',
      label: 'Legal name',
      section: 'Business Information',
      inputType: 'text',
      required: true,
      material: true,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: false,
    },
    {
      id: 'business-annual-revenue',
      canonicalField: 'business.annualRevenue',
      label: 'Annual revenue',
      section: 'Business Information',
      inputType: 'currency',
      required: true,
      material: true,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: true,
      validation: { min: 0 },
    },
    {
      id: 'business-naics-code',
      canonicalField: 'business.naicsCode',
      label: 'NAICS code',
      section: 'Business Information',
      inputType: 'text',
      required: true,
      material: true,
      requiresCustomerConfirmation: false,
      requiresBrokerVerification: false,
    },
    {
      id: 'business-employee-count',
      canonicalField: 'business.employeeCount',
      label: 'Number of employees',
      section: 'Operations',
      inputType: 'number',
      required: true,
      material: true,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: false,
      validation: { min: 1 },
    },
    {
      id: 'business-years-in-business',
      canonicalField: 'business.yearsInBusiness',
      label: 'Years in business',
      section: 'Operations',
      inputType: 'number',
      required: true,
      material: false,
      requiresCustomerConfirmation: false,
      requiresBrokerVerification: false,
      validation: { min: 0 },
    },
    {
      id: 'business-fein',
      canonicalField: 'business.fein',
      label: 'FEIN',
      section: 'Business Information',
      inputType: 'text',
      required: true,
      material: true,
      requiresCustomerConfirmation: false,
      requiresBrokerVerification: true,
    },
    {
      id: 'current-insurance-effective-date',
      canonicalField: 'currentInsurance.effectiveDate',
      label: 'Desired effective date',
      section: 'Coverage',
      inputType: 'date',
      required: true,
      material: true,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: false,
    },
  ],
}

export const commercialGeneralLiabilityDefinition: ApplicationDefinition = {
  id: 'commercial-general-liability',
  lineOfBusiness: 'General Liability',
  version: 1,
  requirements: [
    {
      id: 'gl-legal-name',
      canonicalField: 'business.legalName',
      label: 'Legal business name',
      section: 'Business Info',
      inputType: 'text',
      required: true,
      material: true,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: false,
    },
    {
      id: 'gl-annual-revenue',
      canonicalField: 'business.annualRevenue',
      label: 'Gross annual revenue',
      section: 'Business Info',
      inputType: 'currency',
      required: true,
      material: true,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: true,
    },
    {
      id: 'gl-employee-count',
      canonicalField: 'business.employeeCount',
      label: 'Employee count',
      section: 'Operations',
      inputType: 'number',
      required: true,
      material: true,
      requiresCustomerConfirmation: false,
      requiresBrokerVerification: false,
    },
    {
      id: 'gl-fein',
      canonicalField: 'business.fein',
      label: 'FEIN',
      section: 'Business Info',
      inputType: 'text',
      required: true,
      material: true,
      requiresCustomerConfirmation: false,
      requiresBrokerVerification: true,
    },
  ],
}

export const commercialAutoDefinition: ApplicationDefinition = {
  id: 'commercial-auto',
  lineOfBusiness: 'Commercial Auto',
  version: 1,
  requirements: [
    {
      id: 'auto-legal-name',
      canonicalField: 'business.legalName',
      label: 'Named insured',
      section: 'Business Info',
      inputType: 'text',
      required: true,
      material: true,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: false,
    },
    {
      id: 'auto-fein',
      canonicalField: 'business.fein',
      label: 'FEIN',
      section: 'Business Info',
      inputType: 'text',
      required: true,
      material: true,
      requiresCustomerConfirmation: false,
      requiresBrokerVerification: true,
    },
    {
      id: 'auto-vehicle-year',
      canonicalField: 'vehicle.year',
      label: 'Vehicle year',
      section: 'Schedule of Vehicles',
      inputType: 'number',
      required: true,
      material: false,
      requiresCustomerConfirmation: true,
      requiresBrokerVerification: false,
    },
    {
      id: 'auto-vehicle-make',
      canonicalField: 'vehicle.make',
      label: 'Vehicle make',
      section: 'Schedule of Vehicles',
      inputType: 'text',
      required: true,
      material: false,
      requiresCustomerConfirmation: false,
      requiresBrokerVerification: false,
    },
  ],
}

const definitions = [commercialAcord125Definition, commercialGeneralLiabilityDefinition, commercialAutoDefinition]

export const getAvailableDefinitions = () => definitions

export const getApplicationDefinition = (definitionId: string, version: number) => {
  const definition = definitions.find((candidate) => candidate.id === definitionId && candidate.version === version)
  if (!definition) {
    throw new Error(`Unknown application definition: ${definitionId}@${version}`)
  }

  return definition
}
