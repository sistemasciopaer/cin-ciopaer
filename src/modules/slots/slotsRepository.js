import { supabaseAutenticado } from '@/lib/supabase'

export async function listarSlotsDisponiveis(token, data) {
  const db = supabaseAutenticado(token)
  let q = db
    .from('slots')
    .select('id, data, hora, numero_slot, capacidade, ocupacao_atual')
    .eq('ativo', true)
    .order('data').order('hora')

  if (data) q = q.eq('data', data)
  // Filtra apenas slots com vaga
  return q.lt('ocupacao_atual', db.raw ? undefined : 5)
}

// Reserva atômica via RPC (função PostgreSQL)
export async function reservarVaga(token, slotId) {
  const db = supabaseAutenticado(token)
  return db.rpc('reservar_vaga', { p_slot_id: slotId })
}

export async function liberarVaga(token, slotId) {
  const db = supabaseAutenticado(token)
  return db.rpc('liberar_vaga', { p_slot_id: slotId })
}
