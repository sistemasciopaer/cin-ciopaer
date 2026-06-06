import { createClient } from '@supabase/supabase-js'

// Vite embute variáveis VITE_ em import.meta.env no momento do build
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

// Debug — aparece no console do navegador durante testes
if (import.meta.env.DEV) {
  console.log('SUPABASE_URL:', SUPABASE_URL ? 'definida' : 'VAZIA')
  console.log('SUPABASE_ANON:', SUPABASE_ANON ? 'definida' : 'VAZIA')
}

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error(
    `Variáveis de ambiente não encontradas.\n` +
    `VITE_SUPABASE_URL: ${SUPABASE_URL ? 'OK' : 'VAZIA'}\n` +
    `VITE_SUPABASE_ANON_KEY: ${SUPABASE_ANON ? 'OK' : 'VAZIA'}`
  )
}

// Cliente base — usado para login (sem token de sessão)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// Cliente autenticado — injetado com token de sessão
// Usar em TODAS as operações após o login
export function supabaseAutenticado(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { 'x-session-token': token } }
  })
}
