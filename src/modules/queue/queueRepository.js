import { supabaseAutenticado } from '@/lib/supabase'

// Não bloqueia o fluxo principal (RN-19) — falha silenciosa
export async function enfileirarEmail(token, {
  agendamentoId, tipoEvento, destinatario, assunto, corpoHtml, prioridade = 5
}) {
  try {
    const db = supabaseAutenticado(token)
    await db.from('email_queue').insert({
      agendamento_id: agendamentoId,
      tipo_evento:    tipoEvento,
      destinatario,
      assunto,
      corpo_html:     corpoHtml,
      prioridade
    })
  } catch (_) { /* silencioso */ }
}
