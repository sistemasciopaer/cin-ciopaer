import { supabaseAutenticado } from '@/lib/supabase'

// Falha silenciosa — auditoria nunca interrompe o fluxo principal
export async function registrarAuditoria(token, { operacao, objeto, objetoId, antes, depois }) {
  try {
    const db = supabaseAutenticado(token)
    await db.from('auditoria').insert({
      operacao,
      objeto,
      objeto_id:   objetoId ?? null,
      antes:       antes   ?? null,
      depois:      depois  ?? null,
      token_sessao: token
    })
  } catch (_) { /* silencioso */ }
}
