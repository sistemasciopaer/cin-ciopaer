import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não configuradas.')
}

// Cliente base — operações públicas (login)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// Cliente autenticado — injetado com token de sessão
// Usar em TODAS as operações após o login
export function supabaseAutenticado(token) {
  return createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { 'x-session-token': token } }
  })
}
