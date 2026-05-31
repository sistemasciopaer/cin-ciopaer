import { supabaseAutenticado } from '@/lib/supabase'

export async function registrarPresenca(token, agendamentoId, confirmadoPor, metodo) {
  const db = supabaseAutenticado(token)
  return db.from('presencas').insert({
    agendamento_id: agendamentoId,
    confirmado_por: confirmadoPor,
    metodo
  })
}

export async function buscarTodosAgendamentos(token, filtros = {}) {
  const db = supabaseAutenticado(token)
  let q = db
    .from('agendamentos')
    .select(`
      id, nome_agendado, cpf_agendado, tipo_pessoa, status, qr_code,
      slot:slots(data, hora),
      responsavel:servidores!servidor_responsavel_id(nome, matricula)
    `)
    .order('criado_em', { ascending: false })

  if (filtros.status) q = q.eq('status', filtros.status)
  return q
}
