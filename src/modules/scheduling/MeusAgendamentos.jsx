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
  AGENDADO:   { txt: 'Agendado',        cor: 'var(--verde)' },
  PRESENTE:   { txt: 'Presente',        cor: '#27AE60' },
  CANCELADO:  { txt: 'Cancelado',       cor: 'var(--vermelho)' },
  REAGENDADO: { txt: 'Reagendado',      cor: 'var(--laranja)' },
  NO_SHOW:    { txt: 'Não compareceu',  cor: '#95A5A6' },
}

function fmtData(d) {
  if (!d) return ''
  const [y,m,dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function qrUrl(qrCode) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}&bgcolor=ffffff&color=006830&margin=14`
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
      .select(`id, nome_agendado, cpf_agendado, tipo_pessoa, status,
               qr_code, email_destino, slot_id, criado_em,
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
    try {
      // 1. Liberar o slot
      await db.rpc('liberar_vaga', { p_slot_id: ag.slot_id })

      // 2. Atualizar status
      await db.from('agendamentos').update({
        status: 'CANCELADO',
        cancelado_por: sessao.servidorId,
      }).eq('id', ag.id)

      // 3. Auditoria
      await registrarAuditoria(sessao.token, {
        operacao: 'CANCELAR_AGENDAMENTO', objeto: 'AGENDAMENTO',
        objetoId: ag.id,
        antes: { status: ag.status },
        depois: { status: 'CANCELADO' },
      })

      // 4. Email (não bloqueante)
      await enfileirarEmail(sessao.token, {
        agendamentoId: ag.id, tipoEvento: 'CANCELAMENTO',
        destinatario: ag.email_destino,
        assunto: 'CANCELAMENTO — AGENDAMENTO PARA EMISSÃO DA CIN',
        corpoHtml: `<p>Seu agendamento de ${fmtData(ag.slot?.data)} às ${ag.slot?.hora?.slice(0,5)} foi cancelado.</p>`,
        prioridade: 2,
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
        onConfirmar={() => cancelar(detalhe)}
        onDesistir={() => setConfirmaCancelar(false)}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={() => setPagina('dashboard')} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff' }}>
          Meus Agendamentos
        </h2>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>
        {/* Filtros */}
        <div style={{ background: '#fff', border: '1.5px solid var(--borda)',
          borderRadius: 'var(--raio-lg)', padding: '12px 14px',
          marginBottom: 14, boxShadow: 'var(--sombra)',
          display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['TODOS','AGENDADO','PRESENTE','CANCELADO'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding: '6px 14px', borderRadius: 20,
              border: `1.5px solid ${filtro===f ? 'var(--verde)' : 'var(--borda)'}`,
              background: filtro===f ? 'var(--verde-claro)' : '#fff',
              color: filtro===f ? 'var(--verde)' : 'var(--texto-2)',
              fontFamily: 'var(--fonte-corpo)', fontSize: '0.78rem',
              fontWeight: filtro===f ? 700 : 400, cursor: 'pointer',
            }}>
              {f === 'TODOS' ? 'Todos' : STATUS_LABEL[f]?.txt}
            </button>
          ))}
        </div>

        {erro && <div style={{ marginBottom: 14 }}><Alerta tipo="erro">{erro}</Alerta></div>}

        {carregando && (
          <p style={{ color: 'var(--texto-3)', textAlign: 'center', padding: 40 }}>Carregando...</p>
        )}

        {!carregando && filtrados.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ color: 'var(--texto-3)', marginBottom: 20 }}>
              Nenhum agendamento encontrado.
            </p>
            <Botao variante="verde" onClick={() => setPagina('agendamento')}>
              Novo Agendamento
            </Botao>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(ag => {
            const st = STATUS_LABEL[ag.status] ?? { txt: ag.status, cor: '#888' }
            return (
              <button key={ag.id} onClick={() => setDetalhe(ag)} style={{
                background: '#fff', border: '1.5px solid var(--borda)',
                borderRadius: 'var(--raio-lg)', padding: '16px 18px',
                textAlign: 'left', cursor: 'pointer', width: '100%',
                boxShadow: 'var(--sombra)',
                transition: 'border-color 0.12s, box-shadow 0.12s',
                fontFamily: 'var(--fonte-corpo)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--verde)'
                e.currentTarget.style.boxShadow = 'var(--sombra-lg)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--borda)'
                e.currentTarget.style.boxShadow = 'var(--sombra)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: 'var(--texto)', fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>
                      {ag.nome_agendado}
                    </p>
                    <p style={{ color: 'var(--texto-3)', fontSize: '0.78rem' }}>
                      {ag.slot ? `${fmtData(ag.slot.data)} às ${ag.slot.hora?.slice(0,5)}` : '—'}
                      {ag.tipo_pessoa === 'DEPENDENTE' && ag.dependente &&
                        ` · ${ag.dependente.parentesco === 'CONJUGE' ? 'Cônjuge' : ag.dependente.parentesco === 'FILHO' ? 'Filho(a)' : ag.dependente.parentesco}`}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px',
                    borderRadius: 20, background: `${st.cor}15`,
                    color: st.cor, border: `1px solid ${st.cor}40`,
                    whiteSpace: 'nowrap', marginLeft: 12,
                  }}>
                    {st.txt}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DetalheAgendamento({ ag, onVoltar, onCancelar, confirmaCancelar,
  cancelando, onConfirmar, onDesistir }) {
  const st = STATUS_LABEL[ag.status] ?? { txt: ag.status, cor: '#888' }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={onVoltar} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff' }}>
          Detalhes
        </h2>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>
        {/* Status */}
        <div style={{ background: '#fff', border: `1.5px solid ${st.cor}40`,
          borderRadius: 'var(--raio-lg)', padding: '14px 18px',
          marginBottom: 14, boxShadow: 'var(--sombra)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%',
            background: st.cor, flexShrink: 0 }}/>
          <span style={{ color: st.cor, fontWeight: 700, fontSize: '0.9rem' }}>{st.txt}</span>
        </div>

        {/* Dados */}
        <div style={{ background: '#fff', border: '1.5px solid var(--borda)',
          borderRadius: 'var(--raio-lg)', padding: '18px', marginBottom: 14,
          boxShadow: 'var(--sombra)' }}>
          {[
            ['Nome',    ag.nome_agendado],
            ['CPF',     formatarCPF(ag.cpf_agendado)],
            ['Tipo',    ag.tipo_pessoa === 'SERVIDOR' ? 'Titular' :
                        ag.dependente?.parentesco === 'CONJUGE' ? 'Cônjuge' :
                        ag.dependente?.parentesco === 'FILHO' ? 'Filho(a)' : 'Dependente'],
            ['Data',    ag.slot ? fmtData(ag.slot.data) : '—'],
            ['Horário', ag.slot ? ag.slot.hora?.slice(0,5) : '—'],
          ].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
              padding: '9px 0', borderBottom: '1px solid var(--borda)' }}>
              <span style={{ color: 'var(--texto-3)', fontSize: '0.82rem' }}>{k}</span>
              <span style={{ color: 'var(--texto)', fontSize: '0.88rem', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* QRCode */}
        {ag.status === 'AGENDADO' && (
          <div style={{ background: '#fff', border: '1.5px solid var(--borda)',
            borderRadius: 'var(--raio-lg)', padding: '20px',
            marginBottom: 14, boxShadow: 'var(--sombra)', textAlign: 'center' }}>
            <p style={{ color: 'var(--texto-3)', fontSize: '0.72rem',
              letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
              QRCode — apresente no atendimento
            </p>
            <img src={qrUrl(ag.qr_code)} alt="QRCode"
              style={{ width: 180, height: 180, borderRadius: 8 }} />
            <p style={{ fontSize: '0.6rem', color: 'var(--texto-3)',
              marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {ag.qr_code}
            </p>
          </div>
        )}

        {/* Cancelar */}
        {ag.status === 'AGENDADO' && !confirmaCancelar && (
          <Botao variante="perigo" onClick={onCancelar}>Cancelar Agendamento</Botao>
        )}

        {confirmaCancelar && (
          <div style={{ background: '#FDF2F2', border: '1.5px solid var(--vermelho)',
            borderRadius: 'var(--raio-lg)', padding: '18px', marginBottom: 14 }}>
            <p style={{ color: 'var(--texto)', marginBottom: 14, fontSize: '0.88rem', lineHeight: 1.5 }}>
              Confirma o cancelamento? A vaga será liberada imediatamente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Botao variante="perigo" carregando={cancelando} onClick={onConfirmar}>
                Sim, cancelar
              </Botao>
              <Botao variante="secundario" onClick={onDesistir}>Não</Botao>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
