import { supabaseAutenticado } from '@/lib/supabase'

export async function listarDependentes(token, servidorId) {
  const db = supabaseAutenticado(token)
  return db
    .from('dependentes')
    .select('id, nome, cpf, parentesco, email')
    .eq('servidor_responsavel_id', servidorId)
    .eq('ativo', true)
    .order('nome')
}

export async function criarDependente(token, dados) {
  const db = supabaseAutenticado(token)
  return db.from('dependentes').insert(dados).select().single()
}
