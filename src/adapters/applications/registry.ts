import type { ApplicationAdapter } from './types'
import { acord125_2016_03_Adapter, acord125_2014_12_Adapter } from './acord125/adapter'

const adapterRegistry: Record<string, ApplicationAdapter> = {
  'acord-125:2016-03': acord125_2016_03_Adapter,
  'acord-125:2014-12': acord125_2014_12_Adapter,
}

export const getAvailableAdapters = (): ApplicationAdapter[] => {
  return Object.values(adapterRegistry)
}

export const getApplicationAdapter = (adapterId: string): ApplicationAdapter => {
  const adapter = adapterRegistry[adapterId]
  if (!adapter) {
    throw new Error(`Unsupported application adapter version: "${adapterId}". Registered adapters: ${Object.keys(adapterRegistry).join(', ')}`)
  }
  return adapter
}

export const findAdapterForLineOfBusiness = (
  lob: string,
  preferredEdition = '2016/03',
): ApplicationAdapter => {
  const all = getAvailableAdapters()
  const matching = all.filter((a) => a.lineOfBusiness.toLowerCase() === lob.toLowerCase() || lob.toLowerCase().includes('commercial'))
  const exactEdition = matching.find((a) => a.edition === preferredEdition)
  if (exactEdition) return exactEdition
  if (matching.length > 0 && matching[0]) return matching[0]

  return acord125_2016_03_Adapter
}
