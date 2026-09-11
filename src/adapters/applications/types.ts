import type { AcordPreview, ApplicationRecord, MappingDefinition } from '../../domain/types'

export interface ApplicationAdapter {
  id: string
  formType: string
  edition: string
  lineOfBusiness: string
  description: string
  mappings: MappingDefinition[]
  buildPreview(application: ApplicationRecord): AcordPreview
}

export interface AdapterVersionMetadata {
  adapterId: string
  formType: string
  edition: string
  effectiveDate: string
  authoritativeStandard: string
}
