import { supabase } from '@/lib/supabase'
import { gerarToken } from '@/lib/token'

export async function criarSessao(servidorId, timeoutMinutos = 30) {
  await supabase
    .from('sessoes')
    .update({ ativa: false })
    .eq('servidor_id', servidorId)
    .eq('ativa', true)

  const token    = gerarToken()
  const expiraEm = new Date(Date.now() + timeoutMinutos * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('sessoes')
    .insert({ servidor_id: servidorId, token, expira_em: expiraEm })

  if (error) throw error
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

export async function invalidarSessao(token) {
  await supabase.from('sessoes').update({ ativa: false }).eq('token', token)
}
