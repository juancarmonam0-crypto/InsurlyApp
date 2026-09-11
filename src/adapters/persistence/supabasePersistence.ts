import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ApplicationFieldState,
  ApplicationRecord,
  ApplicationSnapshotRecord,
  ConflictRecord,
  CustomerRecord,
  FieldProvenance,
  FieldValue,
} from '../../domain/types'
import { getSupabaseBrowserClient } from './supabaseClient'
import type { ApplicationWorkspace, PersistenceLoadOptions, PersistencePort } from './types'

interface CustomerRow {
  id: string
  agency_id: string
  type: string
  display_name: string
  email: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

interface BusinessRow {
  id: string
  agency_id: string
  customer_id: string
  legal_name: string
  dba_name: string | null
  entity_type: string
  state_of_formation: string | null
  annual_revenue: number | null
  naics_code: string | null
  employee_count: number | null
  years_in_business: number | null
  fein: string | null
  description: string | null
  created_at: string
  updated_at: string
}

interface PersonRow {
  id: string
  agency_id: string
  customer_id: string
  first_name: string | null
  last_name: string | null
  dob: string | null
  role: string | null
  email: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

interface LocationRow {
  id: string
  agency_id: string
  customer_id: string
  label: string | null
  address_line_1: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  occupancy: string | null
  created_at: string
  updated_at: string
}

interface VehicleRow {
  id: string
  agency_id: string
  customer_id: string
  year: number | null
  make: string | null
  model: string | null
  vin: string | null
  usage: string | null
  created_at: string
  updated_at: string
}

interface PolicyRow {
  id: string
  agency_id: string
  customer_id: string
  carrier_name: string | null
  effective_date: string | null
  expiration_date: string | null
  limits: string | null
  premium: number | null
  created_at: string
  updated_at: string
}

interface LossRow {
  id: string
  agency_id: string
  customer_id: string
  loss_date: string | null
  description: string | null
  amount: number | null
  status: string | null
  created_at: string
  updated_at: string
}

interface DocumentRow {
  id: string
  agency_id: string
  customer_id: string
  application_id: string | null
  storage_path: string | null
  filename: string
  mime_type: string | null
  document_type: string | null
  status: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
}

interface ProfileFactRow {
  id: string
  agency_id: string
  customer_id: string
  entity_type: string
  entity_id: string | null
  field_key: string
  value_json: unknown
  source_type: string
  source_reference: string | null
  confidence: number | null
  customer_confirmed: boolean
  broker_verified: boolean
  metadata_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

interface ApplicationRow {
  id: string
  agency_id: string
  customer_id: string
  definition_id: string
  definition_version: number
  line_of_business: string
  status: string
  customer_name: string | null
  completion: number | null
  missing_fields_json: string[] | null
  customer_confirmed: boolean | null
  broker_verified: boolean | null
  broker_notes_json: string[] | null
  generated_at: string | null
  profile_json: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface FieldStateRow {
  id: string
  agency_id: string
  application_id: string
  field_key: string
  value_json: unknown
  selected_source: string | null
  customer_confirmed: boolean
  broker_verified: boolean
  updated_at: string
}

interface ProvenanceRow {
  id: string
  agency_id: string
  application_id: string
  field_key: string
  value_json: unknown
  source_type: string
  source_reference: string | null
  confidence: number | null
  created_at: string
  metadata_json: Record<string, unknown> | null
}

interface ConflictRow {
  id: string
  agency_id: string
  application_id: string
  field_key: string
  conflict_type: string | null
  blocking: boolean
  status: string
  payload_json: Record<string, unknown> | null
  resolution_action: string | null
  resolved_at: string | null
  created_at: string
}

interface SnapshotRow {
  id: string
  agency_id: string
  application_id: string
  application_definition_id: string
  application_definition_version: number
  snapshot_json: Record<string, unknown>
  snapshot_hash: string
  created_at: string
  created_by: string
}

const clone = <T>(value: T) => structuredClone(value)

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  }
}

const joinName = (firstName?: string | null, lastName?: string | null) => `${firstName ?? ''} ${lastName ?? ''}`.trim()

const buildDocumentStoragePath = (agencyId: string, customerId: string, applicationId: string | undefined, fileName: string) => {
  const safeFileName = fileName.replaceAll(/[\\/]/g, '-')
  return `${agencyId}/${customerId}/${applicationId ?? 'profile'}/${safeFileName}`
}

const fromDocumentRow = (row: DocumentRow) => ({
  id: row.id,
  agency_id: row.agency_id,
  customer_id: row.customer_id,
  application_id: row.application_id ?? undefined,
  type: row.document_type ?? 'Document',
  fileName: row.filename,
  status: (row.status ?? 'uploading') as ApplicationRecord['profile']['documents'][number]['status'],
  uploadedAt: row.created_at,
  storagePath: row.storage_path ?? undefined,
  mimeType: row.mime_type ?? undefined,
  metadata: (row.metadata_json as Record<string, string | number | boolean> | null) ?? undefined,
})

const fromProvenanceRow = (row: ProvenanceRow): FieldProvenance => ({
  id: row.id,
  agency_id: row.agency_id,
  application_id: row.application_id,
  canonicalField: row.field_key,
  label: String(row.metadata_json?.label ?? row.field_key),
  value: row.value_json as FieldProvenance['value'],
  sourceType: row.source_type as FieldProvenance['sourceType'],
  sourceDocument: row.source_reference ?? undefined,
  sourcePage: typeof row.metadata_json?.sourcePage === 'number' ? row.metadata_json.sourcePage : undefined,
  confidence: row.confidence ?? undefined,
  customerConfirmed: Boolean(row.metadata_json?.customerConfirmed),
  brokerVerified: Boolean(row.metadata_json?.brokerVerified),
  timestamp: row.created_at,
  metadata: (row.metadata_json as Record<string, string | number | boolean> | null) ?? undefined,
})

const fromConflictRow = (row: ConflictRow): ConflictRecord => {
  const payload = row.payload_json ?? {}
  return {
    id: row.id,
    agency_id: row.agency_id,
    application_id: row.application_id,
    canonicalField: row.field_key,
    label: String(payload.label ?? row.field_key),
    status: row.status as ConflictRecord['status'],
    message: String(payload.message ?? 'Conflicting information detected. Broker review recommended.'),
    customerValue: payload.customerValue as ConflictRecord['customerValue'],
    evidence: (payload.evidence as FieldProvenance[] | undefined) ?? [],
    material: Boolean(payload.material),
    blocking: row.blocking,
    updatedAt: row.resolved_at ?? row.created_at,
    resolution: payload.resolution as ConflictRecord['resolution'],
  }
}

const fromSnapshotRow = (row: SnapshotRow): ApplicationSnapshotRecord => ({
  id: row.id,
  agency_id: row.agency_id,
  application_id: row.application_id,
  applicationDefinitionId: row.application_definition_id,
  applicationDefinitionVersion: row.application_definition_version,
  snapshotHash: row.snapshot_hash,
  createdAt: row.created_at,
  createdBy: row.created_by,
  snapshot: clone(row.snapshot_json as unknown as ApplicationSnapshotRecord['snapshot']),
})

const assertNoError = <T>(result: { data: T; error: { message: string } | null }) => {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

const assertWriteResult = async (promise: PromiseLike<{ error: { message: string } | null }>) => {
  const result = await promise
  if (result.error) throw new Error(result.error.message)
}

const syncCustomerChildRows = async (
  client: SupabaseClient,
  table: 'people' | 'locations' | 'vehicles' | 'loss_history' | 'documents',
  agencyId: string,
  customerId: string,
  currentIds: string[],
) => {
  const rows = assertNoError((await client
    .from(table)
    .select('id')
    .eq('agency_id', agencyId)
    .eq('customer_id', customerId)) as { data: Array<{ id: string }>; error: { message: string } | null })
  const staleIds = rows.map((row) => row.id).filter((id) => !currentIds.includes(id))
  if (staleIds.length === 0) return

  await assertWriteResult(client
    .from(table)
    .delete()
    .eq('agency_id', agencyId)
    .eq('customer_id', customerId)
    .in('id', staleIds))
}

const syncApplicationConflicts = async (client: SupabaseClient, agencyId: string, applicationId: string, currentIds: string[]) => {
  const rows = assertNoError((await client
    .from('application_conflicts')
    .select('id')
    .eq('agency_id', agencyId)
    .eq('application_id', applicationId)) as { data: Array<{ id: string }>; error: { message: string } | null })
  const staleIds = rows.map((row) => row.id).filter((id) => !currentIds.includes(id))
  if (staleIds.length === 0) return

  await assertWriteResult(client
    .from('application_conflicts')
    .delete()
    .eq('agency_id', agencyId)
    .eq('application_id', applicationId)
    .in('id', staleIds))
}

export const createSupabasePersistence = (client: SupabaseClient = getSupabaseBrowserClient()): PersistencePort => ({
  mode: 'supabase',
  async loadWorkspace({ agencyId, applicationId, customerId, fallbackWorkspace }: PersistenceLoadOptions): Promise<ApplicationWorkspace> {
    const applicationRow = (await client
      .from('applications')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('id', applicationId)
      .maybeSingle()) as { data: ApplicationRow | null; error: { message: string } | null }
    if (applicationRow.error) throw new Error(applicationRow.error.message)
    if (!applicationRow.data) return clone(fallbackWorkspace)

    const [customerRowResult, businessRowResult, peopleRowsResult, locationRowsResult, vehicleRowsResult, policyRowResult, lossRowsResult, documentRowsResult, profileFactRowsResult, fieldStateRowsResult, provenanceRowsResult, conflictRowsResult, snapshotRowsResult] = await Promise.all([
      client.from('customers').select('*').eq('agency_id', agencyId).eq('id', customerId).maybeSingle(),
      client.from('businesses').select('*').eq('agency_id', agencyId).eq('customer_id', customerId).maybeSingle(),
      client.from('people').select('*').eq('agency_id', agencyId).eq('customer_id', customerId),
      client.from('locations').select('*').eq('agency_id', agencyId).eq('customer_id', customerId),
      client.from('vehicles').select('*').eq('agency_id', agencyId).eq('customer_id', customerId),
      client.from('customer_policies').select('*').eq('agency_id', agencyId).eq('customer_id', customerId).maybeSingle(),
      client.from('loss_history').select('*').eq('agency_id', agencyId).eq('customer_id', customerId),
      client.from('documents').select('*').eq('agency_id', agencyId).eq('customer_id', customerId),
      client.from('customer_profile_facts').select('*').eq('agency_id', agencyId).eq('customer_id', customerId),
      client.from('application_field_states').select('*').eq('agency_id', agencyId).eq('application_id', applicationId),
      client.from('field_provenance').select('*').eq('agency_id', agencyId).eq('application_id', applicationId).order('created_at'),
      client.from('application_conflicts').select('*').eq('agency_id', agencyId).eq('application_id', applicationId).order('created_at'),
      client.from('application_snapshots').select('*').eq('agency_id', agencyId).eq('application_id', applicationId).order('created_at'),
    ])

    const customerRow = assertNoError(customerRowResult as { data: CustomerRow | null; error: { message: string } | null })
    const businessRow = assertNoError(businessRowResult as { data: BusinessRow | null; error: { message: string } | null })
    const peopleRows = assertNoError(peopleRowsResult as { data: PersonRow[]; error: { message: string } | null })
    const locationRows = assertNoError(locationRowsResult as { data: LocationRow[]; error: { message: string } | null })
    const vehicleRows = assertNoError(vehicleRowsResult as { data: VehicleRow[]; error: { message: string } | null })
    const policyRow = assertNoError(policyRowResult as { data: PolicyRow | null; error: { message: string } | null })
    const lossRows = assertNoError(lossRowsResult as { data: LossRow[]; error: { message: string } | null })
    const documentRows = assertNoError(documentRowsResult as { data: DocumentRow[]; error: { message: string } | null })
    const profileFactRows = assertNoError(profileFactRowsResult as { data: ProfileFactRow[]; error: { message: string } | null })
    const fieldStateRows = assertNoError(fieldStateRowsResult as { data: FieldStateRow[]; error: { message: string } | null })
    const provenanceRows = assertNoError(provenanceRowsResult as { data: ProvenanceRow[]; error: { message: string } | null })
    const conflictRows = assertNoError(conflictRowsResult as { data: ConflictRow[]; error: { message: string } | null })
    const snapshotRows = assertNoError(snapshotRowsResult as { data: SnapshotRow[]; error: { message: string } | null })

    const profile = clone(applicationRow.data.profile_json as unknown as ApplicationRecord['profile'])
    const fallbackCustomer = clone(fallbackWorkspace.customer)

    const customer: CustomerRecord = {
      id: customerRow?.id ?? fallbackCustomer.id,
      agency_id: customerRow?.agency_id ?? fallbackCustomer.agency_id,
      type: (customerRow?.type as CustomerRecord['type'] | undefined) ?? fallbackCustomer.type,
      displayName: customerRow?.display_name ?? applicationRow.data.customer_name ?? fallbackCustomer.displayName,
      email: customerRow?.email ?? fallbackCustomer.email,
      phone: customerRow?.phone ?? fallbackCustomer.phone,
      createdAt: customerRow?.created_at ?? fallbackCustomer.createdAt,
      updatedAt: customerRow?.updated_at ?? fallbackCustomer.updatedAt,
      profile: {
        agency_id: customerRow?.agency_id ?? fallbackCustomer.profile.agency_id,
        customer_id: customerRow?.id ?? fallbackCustomer.profile.customer_id,
        preferredChannel: clone((profile.preferredChannel ?? fallbackCustomer.profile.preferredChannel) as CustomerRecord['profile']['preferredChannel']),
        business: businessRow ? {
          agency_id: businessRow.agency_id,
          legalName: businessRow.legal_name,
          dba: businessRow.dba_name ?? undefined,
          entityType: businessRow.entity_type,
          stateOfFormation: businessRow.state_of_formation ?? '',
          annualRevenue: businessRow.annual_revenue ?? 0,
          naicsCode: businessRow.naics_code ?? '',
          employeeCount: businessRow.employee_count ?? 0,
          yearsInBusiness: businessRow.years_in_business ?? undefined,
          fein: businessRow.fein ?? undefined,
          description: businessRow.description ?? '',
        } : clone(profile.business),
        people: peopleRows.length > 0 ? peopleRows.map((row) => ({
          agency_id: row.agency_id,
          id: row.id,
          fullName: joinName(row.first_name, row.last_name),
          role: row.role ?? '',
          email: row.email ?? '',
          phone: row.phone ?? '',
        })) : clone(profile.people),
        locations: locationRows.length > 0 ? locationRows.map((row) => ({
          agency_id: row.agency_id,
          id: row.id,
          label: row.label ?? '',
          addressLine1: row.address_line_1 ?? '',
          city: row.city ?? '',
          state: row.state ?? '',
          postalCode: row.postal_code ?? '',
          occupancy: row.occupancy ?? '',
        })) : clone(profile.locations),
        vehicles: vehicleRows.length > 0 ? vehicleRows.map((row) => ({
          agency_id: row.agency_id,
          id: row.id,
          year: row.year ?? 0,
          make: row.make ?? '',
          model: row.model ?? '',
          vin: row.vin ?? '',
          usage: row.usage ?? '',
        })) : clone(profile.vehicles),
        currentInsurance: policyRow ? {
          agency_id: policyRow.agency_id,
          carrierName: policyRow.carrier_name ?? '',
          effectiveDate: policyRow.effective_date ?? undefined,
          expirationDate: policyRow.expiration_date ?? '',
          limits: policyRow.limits ?? '',
          premium: policyRow.premium ?? 0,
        } : clone(profile.currentInsurance),
        lossHistory: lossRows.length > 0 ? lossRows.map((row) => ({
          agency_id: row.agency_id,
          id: row.id,
          date: row.loss_date ?? '',
          description: row.description ?? '',
          amount: row.amount ?? 0,
          status: row.status ?? '',
        })) : clone(profile.lossHistory),
        documents: documentRows.length > 0 ? documentRows.map(fromDocumentRow) : clone(profile.documents),
        facts: profileFactRows.map((row) => ({
          id: row.id,
          agency_id: row.agency_id,
          customer_id: row.customer_id,
          entityType: row.entity_type as ProfileFactRow['entity_type'] as never,
          entityId: row.entity_id ?? undefined,
          fieldKey: row.field_key,
          value: row.value_json as FieldValue,
          sourceType: row.source_type as never,
          sourceReference: row.source_reference ?? undefined,
          confidence: row.confidence ?? undefined,
          customerConfirmed: row.customer_confirmed,
          brokerVerified: row.broker_verified,
          updatedAt: row.updated_at,
          metadata: (row.metadata_json as Record<string, string | number | boolean> | null) ?? undefined,
        })),
      },
    }

    const application: ApplicationRecord = {
      agency_id: applicationRow.data.agency_id,
      id: applicationRow.data.id,
      customerId: applicationRow.data.customer_id,
      customerName: applicationRow.data.customer_name ?? customer.displayName,
      lineOfBusiness: applicationRow.data.line_of_business,
      definitionId: applicationRow.data.definition_id,
      definitionVersion: applicationRow.data.definition_version,
      status: applicationRow.data.status as ApplicationRecord['status'],
      completion: applicationRow.data.completion ?? 0,
      missingFields: applicationRow.data.missing_fields_json ?? [],
      customerConfirmed: Boolean(applicationRow.data.customer_confirmed),
      brokerVerified: Boolean(applicationRow.data.broker_verified),
      brokerNotes: applicationRow.data.broker_notes_json ?? [],
      generatedAt: applicationRow.data.generated_at ?? undefined,
      createdAt: applicationRow.data.created_at,
      updatedAt: applicationRow.data.updated_at,
      profile,
      fieldStates: fieldStateRows.map((row) => ({
        canonicalField: row.field_key,
        selectedValue: row.value_json as ApplicationFieldState['selectedValue'],
        selectedEvidenceId: row.selected_source ?? undefined,
        customerConfirmed: row.customer_confirmed,
        brokerVerified: row.broker_verified,
        updatedAt: row.updated_at,
      })),
      conflicts: conflictRows.map(fromConflictRow),
    }

    application.profile.fieldProvenance = provenanceRows.map(fromProvenanceRow)

    return {
      application,
      customer,
      snapshots: snapshotRows.map(fromSnapshotRow),
    }
  },
  async listApplications(agencyId: string) {
    const rows = assertNoError((await client.from('applications').select('*').eq('agency_id', agencyId)) as { data: ApplicationRow[]; error: { message: string } | null })
    return rows.map((row) => ({
      agency_id: row.agency_id,
      id: row.id,
      customerId: row.customer_id,
      customerName: row.customer_name ?? '',
      lineOfBusiness: row.line_of_business,
      definitionId: row.definition_id,
      definitionVersion: row.definition_version,
      status: row.status as ApplicationRecord['status'],
      completion: row.completion ?? 0,
      missingFields: row.missing_fields_json ?? [],
      customerConfirmed: Boolean(row.customer_confirmed),
      brokerVerified: Boolean(row.broker_verified),
      brokerNotes: row.broker_notes_json ?? [],
      generatedAt: row.generated_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      profile: clone(row.profile_json as unknown as ApplicationRecord['profile']),
      fieldStates: [],
      conflicts: [],
    }))
  },
  async saveCustomer(customer: CustomerRecord) {
    await Promise.all([
      syncCustomerChildRows(client, 'people', customer.agency_id, customer.id, customer.profile.people.map((person) => person.id)),
      syncCustomerChildRows(client, 'locations', customer.agency_id, customer.id, customer.profile.locations.map((location) => location.id)),
      syncCustomerChildRows(client, 'vehicles', customer.agency_id, customer.id, customer.profile.vehicles.map((vehicle) => vehicle.id)),
      syncCustomerChildRows(client, 'loss_history', customer.agency_id, customer.id, customer.profile.lossHistory.map((loss) => loss.id)),
      syncCustomerChildRows(client, 'documents', customer.agency_id, customer.id, customer.profile.documents.map((document) => document.id)),
    ])

    await assertWriteResult(client.from('customers').upsert({
      id: customer.id,
      agency_id: customer.agency_id,
      type: customer.type,
      display_name: customer.displayName,
      email: customer.email ?? null,
      phone: customer.phone ?? null,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    }))

    await assertWriteResult(client.from('businesses').upsert({
      id: `${customer.id}-business`,
      agency_id: customer.agency_id,
      customer_id: customer.id,
      legal_name: customer.profile.business.legalName,
      dba_name: customer.profile.business.dba ?? null,
      entity_type: customer.profile.business.entityType,
      state_of_formation: customer.profile.business.stateOfFormation,
      annual_revenue: customer.profile.business.annualRevenue,
      naics_code: customer.profile.business.naicsCode,
      employee_count: customer.profile.business.employeeCount,
      years_in_business: customer.profile.business.yearsInBusiness ?? null,
      fein: customer.profile.business.fein ?? null,
      description: customer.profile.business.description,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    }))

    if (customer.profile.people.length > 0) {
      await assertWriteResult(client.from('people').upsert(customer.profile.people.map((person) => {
        const { firstName, lastName } = splitName(person.fullName)
        return {
          id: person.id,
          agency_id: customer.agency_id,
          customer_id: customer.id,
          first_name: firstName,
          last_name: lastName,
          dob: null,
          role: person.role,
          email: person.email,
          phone: person.phone,
          created_at: customer.createdAt,
          updated_at: customer.updatedAt,
        }
      })))
    }

    if (customer.profile.locations.length > 0) {
      await assertWriteResult(client.from('locations').upsert(customer.profile.locations.map((location) => ({
        id: location.id,
        agency_id: customer.agency_id,
        customer_id: customer.id,
        label: location.label,
        address_line_1: location.addressLine1,
        city: location.city,
        state: location.state,
        postal_code: location.postalCode,
        occupancy: location.occupancy,
        created_at: customer.createdAt,
        updated_at: customer.updatedAt,
      }))))
    }

    if (customer.profile.vehicles.length > 0) {
      await assertWriteResult(client.from('vehicles').upsert(customer.profile.vehicles.map((vehicle) => ({
        id: vehicle.id,
        agency_id: customer.agency_id,
        customer_id: customer.id,
        year: vehicle.year,
        make: vehicle.make,
        model: vehicle.model,
        vin: vehicle.vin,
        usage: vehicle.usage,
        created_at: customer.createdAt,
        updated_at: customer.updatedAt,
      }))))
    }

    await assertWriteResult(client.from('customer_policies').upsert({
      id: `${customer.id}-policy`,
      agency_id: customer.agency_id,
      customer_id: customer.id,
      carrier_name: customer.profile.currentInsurance.carrierName,
      effective_date: customer.profile.currentInsurance.effectiveDate ?? null,
      expiration_date: customer.profile.currentInsurance.expirationDate,
      limits: customer.profile.currentInsurance.limits,
      premium: customer.profile.currentInsurance.premium,
      created_at: customer.createdAt,
      updated_at: customer.updatedAt,
    }))

    if (customer.profile.lossHistory.length > 0) {
      await assertWriteResult(client.from('loss_history').upsert(customer.profile.lossHistory.map((loss) => ({
        id: loss.id,
        agency_id: customer.agency_id,
        customer_id: customer.id,
        loss_date: loss.date,
        description: loss.description,
        amount: loss.amount,
        status: loss.status,
        created_at: customer.createdAt,
        updated_at: customer.updatedAt,
      }))))
    }

    if (customer.profile.documents.length > 0) {
      await assertWriteResult(client.from('documents').upsert(customer.profile.documents.map((document) => ({
        id: document.id,
        agency_id: customer.agency_id,
        customer_id: customer.id,
        application_id: document.application_id ?? null,
        storage_path: document.storagePath ?? buildDocumentStoragePath(customer.agency_id, customer.id, document.application_id, document.fileName),
        filename: document.fileName,
        mime_type: document.mimeType ?? null,
        document_type: document.type,
        status: document.status,
        metadata_json: document.metadata ?? {},
        created_at: document.uploadedAt,
      }))))
    }

    if (customer.profile.facts && customer.profile.facts.length > 0) {
      await assertWriteResult(client.from('customer_profile_facts').upsert(customer.profile.facts.map((fact) => ({
        id: fact.id,
        agency_id: customer.agency_id,
        customer_id: customer.id,
        entity_type: fact.entityType,
        entity_id: fact.entityId ?? '',
        field_key: fact.fieldKey,
        value_json: fact.value,
        source_type: fact.sourceType,
        source_reference: fact.sourceReference ?? null,
        confidence: fact.confidence ?? null,
        customer_confirmed: fact.customerConfirmed,
        broker_verified: fact.brokerVerified,
        metadata_json: fact.metadata ?? {},
        created_at: fact.updatedAt,
        updated_at: fact.updatedAt,
      }))))
    }
  },
  async saveApplication(application: ApplicationRecord) {
    await assertWriteResult(client.from('applications').upsert({
      id: application.id,
      agency_id: application.agency_id,
      customer_id: application.customerId,
      definition_id: application.definitionId,
      definition_version: application.definitionVersion,
      line_of_business: application.lineOfBusiness,
      status: application.status,
      customer_name: application.customerName,
      completion: application.completion,
      missing_fields_json: application.missingFields,
      customer_confirmed: application.customerConfirmed,
      broker_verified: application.brokerVerified,
      broker_notes_json: application.brokerNotes,
      generated_at: application.generatedAt ?? null,
      profile_json: application.profile,
      created_at: application.createdAt,
      updated_at: application.updatedAt,
    }))
  },
  async saveFieldStates(agencyId: string, applicationId: string, fieldStates: ApplicationFieldState[]) {
    await assertWriteResult(client.from('application_field_states').upsert(fieldStates.map((fieldState) => ({
      id: `${applicationId}:${fieldState.canonicalField}`,
      agency_id: agencyId,
      application_id: applicationId,
      field_key: fieldState.canonicalField,
      value_json: fieldState.selectedValue ?? null,
      selected_source: fieldState.selectedEvidenceId ?? null,
      customer_confirmed: fieldState.customerConfirmed,
      broker_verified: fieldState.brokerVerified,
      updated_at: fieldState.updatedAt,
    }))))
  },
  async appendProvenance(agencyId: string, applicationId: string, provenance: FieldProvenance[]) {
    await assertWriteResult(client.from('field_provenance').upsert(provenance.map((item) => ({
      id: item.id,
      agency_id: agencyId,
      application_id: applicationId,
      field_key: item.canonicalField,
      value_json: item.value,
      source_type: item.sourceType,
      source_reference: item.sourceDocument ?? null,
      confidence: item.confidence ?? null,
      created_at: item.timestamp,
      metadata_json: {
        label: item.label,
        sourcePage: item.sourcePage,
        customerConfirmed: item.customerConfirmed,
        brokerVerified: item.brokerVerified,
        ...(item.metadata ?? {}),
      },
    }))))
  },
  async saveConflicts(agencyId: string, applicationId: string, conflicts: ConflictRecord[]) {
    await syncApplicationConflicts(client, agencyId, applicationId, conflicts.map((conflict) => conflict.id))
    if (conflicts.length === 0) return

    await assertWriteResult(client.from('application_conflicts').upsert(conflicts.map((conflict) => ({
      id: conflict.id,
      agency_id: agencyId,
      application_id: applicationId,
      field_key: conflict.canonicalField,
      conflict_type: 'field_value_conflict',
      blocking: conflict.blocking,
      status: conflict.status,
      payload_json: {
        label: conflict.label,
        message: conflict.message,
        customerValue: conflict.customerValue,
        evidence: conflict.evidence,
        material: conflict.material,
        resolution: conflict.resolution,
      },
      resolution_action: conflict.resolution?.type ?? null,
      resolved_at: conflict.resolution?.resolvedAt ?? null,
      created_at: conflict.updatedAt,
    }))))
  },
  async createSnapshot(snapshot: ApplicationSnapshotRecord) {
    await assertWriteResult(client.from('application_snapshots').insert({
      id: snapshot.id,
      agency_id: snapshot.agency_id,
      application_id: snapshot.application_id,
      application_definition_id: snapshot.applicationDefinitionId,
      application_definition_version: snapshot.applicationDefinitionVersion,
      snapshot_json: snapshot.snapshot,
      snapshot_hash: snapshot.snapshotHash,
      created_at: snapshot.createdAt,
      created_by: snapshot.createdBy,
    }))
    return clone(snapshot)
  },
  async listSnapshots(agencyId: string, applicationId: string) {
    const rows = assertNoError((await client
      .from('application_snapshots')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('application_id', applicationId)
      .order('created_at')) as { data: SnapshotRow[]; error: { message: string } | null })
    return rows.map(fromSnapshotRow)
  },
  async loadSnapshot(agencyId: string, snapshotId: string) {
    const row = (await client
      .from('application_snapshots')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('id', snapshotId)
      .maybeSingle()) as { data: SnapshotRow | null; error: { message: string } | null }
    if (row.error) throw new Error(row.error.message)
    return row.data ? fromSnapshotRow(row.data) : null
  },
})
