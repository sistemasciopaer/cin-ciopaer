import { supabaseAutenticado } from '@/lib/supabase'

export async function criarAgendamento(token, dados) {
  const db = supabaseAutenticado(token)
  return db.from('agendamentos').insert(dados).select().single()
}

export async function listarMeusAgendamentos(token, servidorId, status) {
  const db = supabaseAutenticado(token)
  let q = db
    .from('agendamentos')
    .select(`
      id, nome_agendado, cpf_agendado, tipo_pessoa,
      status, qr_code, email_destino, criado_em,
      slot:slots(data, hora),
      dependente:dependentes(nome, parentesco)
    `)
    .eq('servidor_responsavel_id', servidorId)
    .order('criado_em', { ascending: false })

  if (status) q = q.eq('status', status)
  return q
}

export async function buscarAgendamentoPorQR(token, qrCode) {
  const db = supabaseAutenticado(token)
  return db
    .from('agendamentos')
    .select(`
      id, nome_agendado, cpf_agendado, tipo_pessoa, status,
      slot:slots(data, hora),
      responsavel:servidores!servidor_responsavel_id(nome, matricula, cpf)
    `)
    .eq('qr_code', qrCode)
    .maybeSingle()
}

export async function atualizarStatusAgendamento(token, id, status, extra = {}) {
  const db = supabaseAutenticado(token)
  return db
    .from('agendamentos')
    .update({ status, ...extra })
    .eq('id', id)
    .select().single()
}
