import { supabase } from '@/lib/supabase'
import { gerarToken } from '@/lib/token'

const TIMEOUT_POR_PERFIL = {
  3: 480, // Administrador — 8 horas
  2: 480, // Supervisor — 8 horas
  1: 30,  // Servidor — 30 minutos
}

const STORAGE_KEY = 'ciopaer_sessao_token'

export async function criarSessao(servidorId, perfilId = 1) {
  await supabase
    .from('sessoes')
    .update({ ativa: false })
    .eq('servidor_id', servidorId)
    .eq('ativa', true)

  const timeoutMinutos = TIMEOUT_POR_PERFIL[perfilId] ?? 30
  const token    = gerarToken()
  const expiraEm = new Date(Date.now() + timeoutMinutos * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('sessoes')
    .insert({ servidor_id: servidorId, token, expira_em: expiraEm, ativa: true })

  if (error) throw error

  salvarTokenLocal(token)
  return { token, expiraEm }
}

export async function validarSessao(token) {
  if (!token) return null
  const { data } = await supabase
    .from('sessoes')
    .select('id, servidor_id, expira_em')
    .eq('token', token)
    .eq('ativa', true)
    .gt('expira_em', new Date().toISOString())
    .maybeSingle()
  return data
}

export async function restaurarSessao() {
  const token = obterTokenLocal()
  if (!token) return null
  const sessao = await validarSessao(token)
  if (!sessao) { removerTokenLocal(); return null }
  return { ...sessao, token }
}

export async function invalidarSessao(token) {
  await supabase.from('sessoes').update({ ativa: false }).eq('token', token)
  removerTokenLocal()
}

export function salvarTokenLocal(token) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, token)
}

export function obterTokenLocal() {
  if (typeof window !== 'undefined') return localStorage.getItem(STORAGE_KEY)
  return null
}

export function removerTokenLocal() {
  if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEY)
}
