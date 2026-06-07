import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { Botao } from '@/components/ui/Botao'
import { Alerta } from '@/components/ui/Alerta'

const BRASAO = 'https://blogger.googleusercontent.com/img/a/AVvXsEj0RgZz8nDwXYQitwlZk0ra9PHwj6bc7SYmAhRMH3-kRox-iLeLXVbU35J5Bg-iQhue8QE4L3liniar8pXig3mTQ-ZwsJIqZdh84GjDOASzsG4VMthRMN6V2uicq452NyVEUS85LFEN8yUeWZxT4fYIU05dIs0Sw_uu5ilMhMvDfipiu1B6jBRfNSVhFQk=s1600'

// Chave Resend embutida no build via variável de ambiente
const RESEND_KEY = import.meta.env.VITE_RESEND_API_KEY
const REMETENTE  = 'CIOPAER <onboarding@resend.dev>'

async function enviarEmailResend({ destinatario, assunto, corpoHtml }) {
  if (!RESEND_KEY) throw new Error('Chave Resend não configurada (VITE_RESEND_API_KEY)')

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${RESEND_KEY}`,
    },
    body: JSON.stringify({
      from:    REMETENTE,
      to:      [destinatario],
      subject: assunto,
      html:    corpoHtml,
    }),
  })

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body?.message ?? `Erro HTTP ${resp.status}`)
  }
  return resp.json()
}

const STATUS_COR = { PENDENTE: '#E67E22', ENVIADO: '#27AE60', ERRO: '#E74C3C' }

const card = {
  background: '#fff', border: '1.5px solid var(--borda)',
  borderRadius: 'var(--raio-lg)', padding: '18px',
  marginBottom: 14, boxShadow: 'var(--sombra)',
}

export function ProcessarEmails() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [fila, setFila]               = useState([])
  const [carregando, setCarregando]   = useState(true)
  const [processando, setProcessando] = useState(false)
  const [log, setLog]                 = useState([])
  const [erro, setErro]               = useState('')
  const [filtro, setFiltro]           = useState('PENDENTE')
  const [progresso, setProgresso]     = useState({ atual: 0, total: 0 })

  useEffect(() => { carregar() }, [filtro])

  async function carregar() {
    setCarregando(true)
    let q = db.from('email_queue')
      .select('id, tipo_evento, destinatario, assunto, corpo_html, status, tentativas, criado_em, erro_ultimo_envio')
      .order('prioridade').order('criado_em').limit(100)
    if (filtro !== 'TODOS') q = q.eq('status', filtro)
    const { data, error } = await q
    setCarregando(false)
    if (error) { setErro('Erro ao carregar fila.'); return }
    setFila(data ?? [])
  }

  function addLog(msg, tipo = 'info') {
    setLog(prev => [...prev, { msg, tipo, ts: new Date().toLocaleTimeString('pt-BR') }])
  }

  async function processarFila() {
    if (!RESEND_KEY) {
      setErro('Chave VITE_RESEND_API_KEY não configurada. Adicione nos Secrets do GitHub e faça novo deploy.')
      return
    }

    const pendentes = fila.filter(e => e.status === 'PENDENTE')
    if (!pendentes.length) { addLog('Nenhum email pendente.', 'aviso'); return }

    setProcessando(true)
    setProgresso({ atual: 0, total: pendentes.length })
    addLog(`Iniciando: ${pendentes.length} email(s) pendente(s)...`, 'info')

    let ok = 0, falhas = 0

    for (let i = 0; i < pendentes.length; i++) {
      const email = pendentes[i]
      setProgresso({ atual: i + 1, total: pendentes.length })
      addLog(`[${i+1}/${pendentes.length}] Enviando → ${email.destinatario}...`, 'info')

      try {
        await enviarEmailResend({
          destinatario: email.destinatario,
          assunto:      email.assunto,
          corpoHtml:    email.corpo_html,
        })

        await db.from('email_queue').update({
          status: 'ENVIADO',
          processado_em: new Date().toISOString(),
          tentativas: (email.tentativas ?? 0) + 1,
          erro_ultimo_envio: null,
        }).eq('id', email.id)

        addLog(`✓ Enviado → ${email.destinatario}`, 'ok')
        ok++
      } catch (e) {
        falhas++
        const errMsg = e.message ?? 'Falha desconhecida'
        const novasTentativas = (email.tentativas ?? 0) + 1
        await db.from('email_queue').update({
          status: novasTentativas >= 3 ? 'ERRO' : 'PENDENTE',
          tentativas: novasTentativas,
          erro_ultimo_envio: errMsg,
        }).eq('id', email.id)
        addLog(`✗ Falha → ${email.destinatario}: ${errMsg}`, 'erro')
      }

      if (i < pendentes.length - 1) await new Promise(r => setTimeout(r, 300))
    }

    addLog(`─── Concluído: ${ok} enviado(s), ${falhas} falha(s) ───`, 'info')
    setProcessando(false)
    await carregar()
  }

  async function reprocessarErros() {
    const erros = fila.filter(e => e.status === 'ERRO')
    if (!erros.length) return
    await Promise.all(erros.map(e =>
      db.from('email_queue').update({ status: 'PENDENTE', tentativas: 0 }).eq('id', e.id)
    ))
    addLog(`${erros.length} email(s) recolocado(s) na fila.`, 'aviso')
    await carregar()
  }

  const pendentesCount = fila.filter(e => e.status === 'PENDENTE').length
  const errosCount     = fila.filter(e => e.status === 'ERRO').length

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={() => setPagina('admin')} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Fila de Emails
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
          {pendentesCount} pendente(s) · {errosCount} erro(s) · via Resend
        </p>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>

        {!RESEND_KEY && (
          <div style={{ marginBottom: 14 }}>
            <Alerta tipo="aviso">
              Chave VITE_RESEND_API_KEY não encontrada.<br/>
              Adicione nos Secrets do GitHub e faça novo deploy.
            </Alerta>
          </div>
        )}

        {erro && <div style={{ marginBottom: 14 }}><Alerta tipo="erro">{erro}</Alerta></div>}

        {/* Ações */}
        <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Botao variante="verde" onClick={processarFila}
            carregando={processando}
            desabilitado={pendentesCount === 0 || !RESEND_KEY}>
            {processando
              ? `Enviando ${progresso.atual}/${progresso.total}...`
              : `Processar ${pendentesCount} pendente(s)`}
          </Botao>
          {errosCount > 0 && (
            <Botao variante="secundario" onClick={reprocessarErros} desabilitado={processando}>
              Reprocessar {errosCount} erro(s)
            </Botao>
          )}
          <Botao variante="secundario" onClick={carregar} desabilitado={processando}>
            Atualizar
          </Botao>
        </div>

        {/* Barra progresso */}
        {processando && (
          <div style={{ ...card }}>
            <div style={{ display: 'flex', justifyContent: 'space-between',
              fontSize: '0.75rem', color: 'var(--texto-3)', marginBottom: 8 }}>
              <span>Progresso</span>
              <span>{progresso.atual}/{progresso.total}</span>
            </div>
            <div style={{ background: 'var(--borda)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: 'var(--verde)',
                width: `${progresso.total ? (progresso.atual/progresso.total)*100 : 0}%`,
                transition: 'width 0.3s' }}/>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div style={{ ...card, padding: '12px 14px', display: 'flex', gap: 8 }}>
          {['TODOS','PENDENTE','ENVIADO','ERRO'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '6px 12px', borderRadius: 20,
              border: `1.5px solid ${filtro===f ? 'var(--verde)' : 'var(--borda)'}`,
              background: filtro===f ? 'var(--verde-claro)' : '#fff',
              color: filtro===f ? 'var(--verde)' : 'var(--texto-2)',
              fontFamily: 'var(--fonte-corpo)', fontSize: '0.75rem',
              fontWeight: filtro===f ? 700 : 400, cursor: 'pointer',
            }}>{f}</button>
          ))}
        </div>

        {/* Lista */}
        {carregando ? (
          <p style={{ color: 'var(--texto-3)', textAlign: 'center', padding: 20 }}>Carregando...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {fila.length === 0 && (
              <p style={{ color: 'var(--texto-3)', textAlign: 'center', padding: 20 }}>
                Nenhum email {filtro !== 'TODOS' ? filtro.toLowerCase() : 'na fila'}.
              </p>
            )}
            {fila.map(e => (
              <div key={e.id} style={{ background: '#fff',
                border: `1.5px solid ${STATUS_COR[e.status]}33`,
                borderRadius: 'var(--raio-lg)', padding: '14px 16px',
                boxShadow: 'var(--sombra)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: 4 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--texto)', fontSize: '0.85rem',
                      fontWeight: 500, marginBottom: 2 }}>{e.destinatario}</p>
                    <p style={{ color: 'var(--texto-3)', fontSize: '0.73rem' }}>
                      {e.tipo_evento} · {e.tentativas ?? 0} tentativa(s)
                    </p>
                    {e.erro_ultimo_envio && (
                      <p style={{ color: 'var(--vermelho)', fontSize: '0.7rem', marginTop: 4 }}>
                        ✗ {e.erro_ultimo_envio.slice(0, 80)}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', padding: '3px 10px', borderRadius: 10,
                    marginLeft: 12, background: `${STATUS_COR[e.status]}15`,
                    color: STATUS_COR[e.status], border: `1px solid ${STATUS_COR[e.status]}40`,
                    whiteSpace: 'nowrap' }}>
                    {e.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={{ background: '#1a2e22', border: '1.5px solid var(--verde)',
            borderRadius: 'var(--raio-lg)', padding: 16, fontFamily: 'monospace',
            fontSize: '0.72rem', lineHeight: 1.9, maxHeight: 280, overflowY: 'auto' }}>
            {log.map((l, i) => (
              <div key={i} style={{
                color: l.tipo==='ok' ? '#2ecc71' : l.tipo==='erro' ? '#e74c3c' :
                       l.tipo==='aviso' ? '#f39c12' : 'rgba(255,255,255,0.5)',
              }}>
                <span style={{ color: 'rgba(255,255,255,0.25)', marginRight: 8 }}>{l.ts}</span>
                {l.msg}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
