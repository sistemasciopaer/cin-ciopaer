import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { Botao } from '@/components/ui/Botao'
import { Alerta } from '@/components/ui/Alerta'

const BRASAO = 'https://blogger.googleusercontent.com/img/a/AVvXsEj0RgZz8nDwXYQitwlZk0ra9PHwj6bc7SYmAhRMH3-kRox-iLeLXVbU35J5Bg-iQhue8QE4L3liniar8pXig3mTQ-ZwsJIqZdh84GjDOASzsG4VMthRMN6V2uicq452NyVEUS85LFEN8yUeWZxT4fYIU05dIs0Sw_uu5ilMhMvDfipiu1B6jBRfNSVhFQk=s1600'

// ── Processador de email via EmailJS (gratuito, sem backend) ──
// Configure em https://emailjs.com:
//   Service ID: seu serviço Gmail
//   Template ID: template com variáveis {{to_email}}, {{subject}}, {{html_content}}
//   Public Key: sua chave pública
const EMAILJS_SERVICE_ID  = 'service_u83t9p7'
const EMAILJS_TEMPLATE_ID = 'template_tfol1wk'
const EMAILJS_PUBLIC_KEY  = '49LZL3uELeMKv1gIC'

export function ProcessarEmails() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [fila, setFila]           = useState([])
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [log, setLog]             = useState([])
  const [erro, setErro]           = useState('')
  const [filtro, setFiltro]       = useState('PENDENTE')

  useEffect(() => { carregar() }, [filtro])

  async function carregar() {
    setCarregando(true)
    const q = db.from('email_queue')
      .select('id, tipo_evento, destinatario, assunto, corpo_html, status, tentativas, criado_em, erro_ultimo_envio')
      .order('prioridade').order('criado_em')

    if (filtro !== 'TODOS') q.eq('status', filtro)

    const { data, error } = await q.limit(50)
    setCarregando(false)
    if (error) { setErro('Erro ao carregar fila.'); return }
    setFila(data ?? [])
  }

  function addLog(msg, tipo = 'info') {
    setLog(prev => [...prev, { msg, tipo, ts: new Date().toLocaleTimeString('pt-BR') }])
  }

  async function processarFila() {
    const pendentes = fila.filter(e => e.status === 'PENDENTE')
    if (pendentes.length === 0) { addLog('Nenhum email pendente.', 'aviso'); return }

    setProcessando(true)
    addLog(`Iniciando processamento de ${pendentes.length} emails...`, 'info')

    // Carregar EmailJS dinamicamente
    let emailjs
    try {
      const mod = await import('https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js')
      emailjs = window.emailjs
    } catch (_) {
      addLog('EmailJS não disponível. Verifique a configuração.', 'erro')
      setProcessando(false)
      return
    }

    let ok = 0, fail = 0

    for (const email of pendentes) {
      try {
        addLog(`Enviando para ${email.destinatario}...`, 'info')

        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email:     email.destinatario,
            subject:      email.assunto,
            html_content: email.corpo_html,
          },
          EMAILJS_PUBLIC_KEY
        )

        await db.from('email_queue').update({
          status: 'ENVIADO',
          processado_em: new Date().toISOString(),
          tentativas: (email.tentativas ?? 0) + 1,
        }).eq('id', email.id)

        addLog(`✓ Enviado para ${email.destinatario}`, 'ok')
        ok++
      } catch (e) {
        fail++
        const errMsg = e?.text ?? e?.message ?? 'Falha desconhecida'
        await db.from('email_queue').update({
          status: (email.tentativas ?? 0) >= 2 ? 'ERRO' : 'PENDENTE',
          tentativas: (email.tentativas ?? 0) + 1,
          erro_ultimo_envio: errMsg,
        }).eq('id', email.id)
        addLog(`✗ Falha para ${email.destinatario}: ${errMsg}`, 'erro')
      }

      await new Promise(r => setTimeout(r, 500))
    }

    addLog(`─── Concluído: ${ok} enviados, ${fail} falhas ───`, 'info')
    setProcessando(false)
    await carregar()
  }

  const STATUS_COR = { PENDENTE: '#f39c12', ENVIADO: '#2ecc71', ERRO: '#e74c3c' }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 600, margin: '0 auto' }}>
      <button onClick={() => setPagina('admin')} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24, padding: 0,
      }}>← Voltar</button>

      <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.4rem',
        fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        Fila de Emails
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: 24 }}>
        {fila.filter(e => e.status === 'PENDENTE').length} pendentes
      </p>

      {erro && <div style={{ marginBottom: 16 }}><Alerta tipo="erro">{erro}</Alerta></div>}

      {/* Ações */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <Botao onClick={processarFila} carregando={processando}
          desabilitado={fila.filter(e => e.status === 'PENDENTE').length === 0}>
          Processar fila agora
        </Botao>
        <Botao variante="secundario" onClick={carregar}>Atualizar</Botao>
      </div>

      {/* Aviso EmailJS */}
      {EMAILJS_SERVICE_ID === 'SEU_SERVICE_ID' && (
        <div style={{ marginBottom: 20 }}>
          <Alerta tipo="info">
            Para enviar emails, configure o EmailJS neste arquivo:<br/>
            1. Acesse emailjs.com e crie uma conta gratuita<br/>
            2. Conecte sua conta Gmail (sistemas.ciopaer@gmail.com)<br/>
            3. Crie um template com as variáveis: to_email, subject, html_content<br/>
            4. Substitua SERVICE_ID, TEMPLATE_ID e PUBLIC_KEY no topo deste arquivo
          </Alerta>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['TODOS','PENDENTE','ENVIADO','ERRO'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '6px 12px', borderRadius: 20,
            border: `1.5px solid ${filtro === f ? 'var(--verde-base)' : 'rgba(255,255,255,0.12)'}`,
            background: filtro === f ? 'rgba(0,128,61,0.15)' : 'transparent',
            color: filtro === f ? '#fff' : 'rgba(255,255,255,0.45)',
            fontFamily: 'var(--fonte-corpo)', fontSize: '0.75rem',
            fontWeight: filtro === f ? 600 : 400, cursor: 'pointer',
          }}>{f}</button>
        ))}
      </div>

      {/* Lista */}
      {carregando ? (
        <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 20 }}>Carregando...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {fila.map(e => (
            <div key={e.id} style={{ background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>{e.destinatario}</span>
                <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: 10,
                  background: `${STATUS_COR[e.status]}20`, color: STATUS_COR[e.status],
                  border: `1px solid ${STATUS_COR[e.status]}40` }}>
                  {e.status}
                </span>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                {e.tipo_evento} · {e.tentativas ?? 0} tentativa(s)
                {e.erro_ultimo_envio && ` · ${e.erro_ultimo_envio.slice(0,60)}`}
              </p>
            </div>
          ))}
          {fila.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>
              Fila vazia.
            </p>
          )}
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div style={{ background: '#060e1c', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: 16, fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.8 }}>
          {log.map((l, i) => (
            <div key={i} style={{
              color: l.tipo === 'ok' ? '#2ecc71' : l.tipo === 'erro' ? '#e74c3c' :
                     l.tipo === 'aviso' ? '#f39c12' : 'rgba(255,255,255,0.4)'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', marginRight: 8 }}>{l.ts}</span>
              {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
