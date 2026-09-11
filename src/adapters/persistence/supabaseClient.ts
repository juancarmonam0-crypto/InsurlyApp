import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type PersistenceProvider = 'auto' | 'local' | 'supabase'

export interface SupabaseBrowserConfig {
  provider: PersistenceProvider
  url?: string
  anonKey?: string
}

export const getSupabaseBrowserConfig = (env: Record<string, string | undefined> = import.meta.env as Record<string, string | undefined>): SupabaseBrowserConfig => ({
  provider: (env.VITE_PERSISTENCE_PROVIDER as PersistenceProvider | undefined) ?? 'auto',
  url: env.VITE_SUPABASE_URL,
  anonKey: env.VITE_SUPABASE_ANON_KEY,
})

export const isSupabaseConfigured = (config = getSupabaseBrowserConfig()) => Boolean(config.url && config.anonKey)

let supabaseClient: SupabaseClient | null = null

export const getSupabaseBrowserClient = (config = getSupabaseBrowserConfig()) => {
  if (!config.url || !config.anonKey) {
    throw new Error('Supabase persistence requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }

  if (!supabaseClient) {
    supabaseClient = createClient(config.url, config.anonKey)
  }

  return supabaseClient
}
