import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { formatarCPF } from '@/lib/cpf'
import { traduzirErro } from '@/lib/erros'
import { registrarAuditoria } from '@/modules/audit/auditRepository'
import { enfileirarEmail } from '@/modules/queue/queueRepository'
import { Botao } from '@/components/ui/Botao'
import { Alerta } from '@/components/ui/Alerta'

const STATUS_LABEL = {
  AGENDADO:    { txt: 'Agendado',    cor: '#00803D' },
  PRESENTE:    { txt: 'Presente',    cor: '#2ecc71' },
  CANCELADO:   { txt: 'Cancelado',   cor: '#e74c3c' },
  REAGENDADO:  { txt: 'Reagendado',  cor: '#f39c12' },
  NO_SHOW:     { txt: 'Não compareceu', cor: '#95a5a6' },
}

const BRASAO = 'https://blogger.googleusercontent.com/img/a/AVvXsEj0RgZz8nDwXYQitwlZk0ra9PHwj6bc7SYmAhRMH3-kRox-iLeLXVbU35J5Bg-iQhue8QE4L3liniar8pXig3mTQ-ZwsJIqZdh84GjDOASzsG4VMthRMN6V2uicq452NyVEUS85LFEN8yUeWZxT4fYIU05dIs0Sw_uu5ilMhMvDfipiu1B6jBRfNSVhFQk=s1600'

function fmtData(d) {
  if (!d) return ''
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function qrImageUrl(qrCode) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}&bgcolor=111f38&color=ffffff&margin=12`
}

export function MeusAgendamentos() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [agendamentos, setAgendamentos] = useState([])
  const [carregando, setCarregando]     = useState(true)
  const [erro, setErro]                 = useState('')
  const [filtro, setFiltro]             = useState('TODOS')
  const [detalhe, setDetalhe]           = useState(null)
  const [cancelando, setCancelando]     = useState(false)
  const [confirmaCancelar, setConfirmaCancelar] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const { data, error } = await db
      .from('agendamentos')
      .select(`id, nome_agendado, cpf_agendado, tipo_pessoa,
               status, qr_code, email_destino, criado_em, atualizado_em,
               slot:slots(data, hora),
               dependente:dependentes(nome, parentesco)`)
      .eq('servidor_responsavel_id', sessao.servidorId)
      .order('criado_em', { ascending: false })

    setCarregando(false)
    if (error) { setErro('Erro ao carregar agendamentos.'); return }
    setAgendamentos(data ?? [])
  }

  async function cancelar(ag) {
    setCancelando(true)
    const db2 = supabaseAutenticado(sessao.token)
    try {
      await db2.rpc('liberar_vaga', { p_slot_id: ag.slot_id ?? ag.slot?.id })
      await db2.from('agendamentos').update({
        status: 'CANCELADO', cancelado_por: sessao.servidorId
      }).eq('id', ag.id)

      await registrarAuditoria(sessao.token, {
        operacao: 'CANCELAR_AGENDAMENTO', objeto: 'AGENDAMENTO',
        objetoId: ag.id, antes: { status: ag.status }, depois: { status: 'CANCELADO' }
      })
      await enfileirarEmail(sessao.token, {
        agendamentoId: ag.id, tipoEvento: 'CANCELAMENTO',
        destinatario: ag.email_destino,
        assunto: 'CANCELAMENTO — AGENDAMENTO PARA EMISSÃO DA CIN',
        corpoHtml: emailCancelamento(ag), prioridade: 2,
      })
      setDetalhe(null)
      setConfirmaCancelar(false)
      await carregar()
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setCancelando(false)
    }
  }

  const filtrados = filtro === 'TODOS'
    ? agendamentos
    : agendamentos.filter(a => a.status === filtro)

  if (detalhe) {
    return (
      <DetalheAgendamento
        ag={detalhe}
        onVoltar={() => { setDetalhe(null); setConfirmaCancelar(false) }}
        onCancelar={() => setConfirmaCancelar(true)}
        confirmaCancelar={confirmaCancelar}
        cancelando={cancelando}
        onConfirmarCancelamento={() => cancelar(detalhe)}
        onDesistirCancelamento={() => setConfirmaCancelar(false)}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24, padding: 0,
      }}>← Voltar</button>

      <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.4rem',
        fontWeight: 700, color: '#fff', marginBottom: 20 }}>
        Meus Agendamentos
      </h2>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['TODOS', 'AGENDADO', 'PRESENTE', 'CANCELADO'].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '7px 14px', borderRadius: 20,
            border: `1.5px solid ${filtro === f ? 'var(--verde-base)' : 'rgba(255,255,255,0.12)'}`,
            background: filtro === f ? 'rgba(0,128,61,0.15)' : 'transparent',
            color: filtro === f ? '#fff' : 'rgba(255,255,255,0.45)',
            fontFamily: 'var(--fonte-corpo)', fontSize: '0.78rem',
            fontWeight: filtro === f ? 600 : 400, cursor: 'pointer',
          }}>
            {f === 'TODOS' ? 'Todos' : STATUS_LABEL[f]?.txt}
          </button>
        ))}
      </div>

      {erro && <div style={{ marginBottom: 16 }}><Alerta tipo="erro">{erro}</Alerta></div>}

      {carregando && (
        <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '40px 0' }}>
          Carregando...
        </p>
      )}

      {!carregando && filtrados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
            Nenhum agendamento encontrado.
          </p>
          <Botao onClick={() => setPagina('agendamento')}>Novo Agendamento</Botao>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtrados.map(ag => {
          const st = STATUS_LABEL[ag.status] ?? { txt: ag.status, cor: '#888' }
          return (
            <button key={ag.id} onClick={() => setDetalhe(ag)} style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 18px',
              textAlign: 'left', cursor: 'pointer',
              transition: 'border-color 0.15s',
              width: '100%',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,128,61,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', marginBottom: 4 }}>
                    {ag.nome_agendado}
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem' }}>
                    {ag.slot ? `${fmtData(ag.slot.data)} às ${ag.slot.hora?.slice(0,5)}` : '—'}
                    {ag.tipo_pessoa === 'DEPENDENTE' && ag.dependente &&
                      ` · ${ag.dependente.parentesco}`}
                  </p>
                </div>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px',
                  borderRadius: 20, background: `${st.cor}22`, color: st.cor,
                  border: `1px solid ${st.cor}44`, whiteSpace: 'nowrap', marginLeft: 12,
                }}>
                  {st.txt}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DetalheAgendamento({ ag, onVoltar, onCancelar, confirmaCancelar,
  cancelando, onConfirmarCancelamento, onDesistirCancelamento }) {
  const st = STATUS_LABEL[ag.status] ?? { txt: ag.status, cor: '#888' }
  const podeCancelar = ag.status === 'AGENDADO'

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={onVoltar} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24, padding: 0,
      }}>← Voltar</button>

      <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
        fontWeight: 700, color: '#fff', marginBottom: 20 }}>
        Detalhes do Agendamento
      </h2>

      {/* Status */}
      <div style={{
        background: `${st.cor}15`, border: `1px solid ${st.cor}44`,
        borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.cor, flexShrink: 0 }}/>
        <span style={{ color: st.cor, fontWeight: 600, fontSize: '0.9rem' }}>{st.txt}</span>
      </div>

      {/* Dados */}
      <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '20px', marginBottom: 20 }}>
        {[
          ['Nome', ag.nome_agendado],
          ['CPF', formatarCPF(ag.cpf_agendado)],
          ['Tipo', ag.tipo_pessoa === 'SERVIDOR' ? 'Titular' : `Dependente — ${ag.dependente?.parentesco ?? ''}`],
          ['Data', ag.slot ? fmtData(ag.slot.data) : '—'],
          ['Horário', ag.slot ? ag.slot.hora?.slice(0,5) : '—'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
            padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>{k}</span>
            <span style={{ color: '#fff', fontSize: '0.88rem', fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* QRCode */}
      {ag.status === 'AGENDADO' && (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem',
            letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
            QRCode para apresentação
          </p>
          <div style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: 20, display: 'inline-block' }}>
            <img src={qrImageUrl(ag.qr_code)} alt="QRCode"
              style={{ width: 180, height: 180, display: 'block' }} />
            <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)',
              marginTop: 8, fontFamily: 'monospace' }}>{ag.qr_code}</p>
          </div>
        </div>
      )}

      {/* Cancelar */}
      {podeCancelar && !confirmaCancelar && (
        <Botao variante="perigo" onClick={onCancelar}>Cancelar Agendamento</Botao>
      )}

      {confirmaCancelar && (
        <div style={{ background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.3)',
          borderRadius: 12, padding: 20 }}>
          <p style={{ color: '#fff', marginBottom: 16, fontSize: '0.9rem', lineHeight: 1.5 }}>
            Confirma o cancelamento? A vaga será liberada e o slot poderá ser ocupado por outro servidor.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <Botao variante="perigo" carregando={cancelando} onClick={onConfirmarCancelamento}>
              Sim, cancelar
            </Botao>
            <Botao variante="secundario" onClick={onDesistirCancelamento}>Não</Botao>
          </div>
        </div>
      )}
    </div>
  )
}

function emailCancelamento(ag) {
  const dataFmt = ag.slot?.data ? fmtData(ag.slot.data) : '—'
  const hora    = ag.slot?.hora?.slice(0,5) ?? '—'
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#00803D;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
      <img src="${BRASAO}" alt="CIOPAER" style="height:60px;margin-bottom:10px;"/>
      <h1 style="color:#fff;margin:0;font-size:1.3rem;letter-spacing:0.08em;">CIOPAER</h1>
    </div>
    <div style="background:#111f38;border-radius:0 0 12px 12px;padding:28px 24px;">
      <p style="color:#f0ece3;font-size:0.95rem;margin:0 0 16px;">
        Olá, <strong>${ag.nome_agendado}</strong>.<br/>
        Seu agendamento foi <strong style="color:#e74c3c;">cancelado</strong>.
      </p>
      <div style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);
        border-radius:10px;padding:16px 20px;margin-bottom:20px;">
        <p style="color:#f0ece3;margin:0;line-height:2;">
          📅 <strong>Data cancelada:</strong> ${dataFmt}<br/>
          🕐 <strong>Horário:</strong> ${hora}
        </p>
      </div>
      <p style="color:rgba(240,236,227,0.5);font-size:0.82rem;">
        Se precisar, realize um novo agendamento pelo sistema.
      </p>
      <p style="color:rgba(240,236,227,0.3);font-size:0.75rem;text-align:center;margin-top:24px;">
        Sistema de Agendamentos CIOPAER
      </p>
    </div>
  </div>
</body></html>`
}

function fmtData(d) {
  if (!d) return ''
  const [y,m,dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function qrImageUrl(qrCode) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}&bgcolor=111f38&color=ffffff&margin=12`
}
