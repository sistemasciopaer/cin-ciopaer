import { supabase } from '@/lib/supabase'
import { normalizarCPF } from '@/lib/cpf'

export async function buscarServidor(matricula, cpf) {
  const { data, error } = await supabase
    .from('servidores')
    .select('id, nome, email, perfil_id, ativo')
    .eq('matricula', matricula.trim())
    .eq('cpf', normalizarCPF(cpf))
    .eq('ativo', true)
    .maybeSingle()
  return { data, error }
}
