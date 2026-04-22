const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  apiBaseUrl: apiBase.replace(/\/$/, ''),
} as const

if (!url || !anonKey) {
  console.error(
    'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for admin login.',
  )
}
