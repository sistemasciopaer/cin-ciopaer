import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { formatarCPF } from '@/lib/cpf'
import { traduzirErro } from '@/lib/erros'
import { registrarAuditoria } from '@/modules/audit/auditRepository'
import { Botao } from '@/components/ui/Botao'
import { Alerta } from '@/components/ui/Alerta'

const STATUS_LABEL = {
  AGENDADO:   { txt: 'Agendado',       cor: 'var(--verde)' },
  PRESENTE:   { txt: 'Presente',       cor: '#27AE60' },
  CANCELADO:  { txt: 'Cancelado',      cor: 'var(--vermelho)' },
  REAGENDADO: { txt: 'Reagendado',     cor: 'var(--laranja)' },
  NO_SHOW:    { txt: 'Não compareceu', cor: '#95A5A6' },
}

const DATAS = [
  { valor: '2026-06-15', label: '15/06/2026 — Segunda-feira' },
  { valor: '2026-06-16', label: '16/06/2026 — Terça-feira' },
]

function fmtData(d) {
  if (!d) return ''
  const [y,m,dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

function qrUrl(qrCode) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrCode)}&bgcolor=ffffff&color=006830&margin=14`
}

const card = {
  background: '#fff', border: '1.5px solid var(--borda)',
  borderRadius: 'var(--raio-lg)', padding: '18px',
  marginBottom: 14, boxShadow: 'var(--sombra)',
}

export function MeusAgendamentos() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [agendamentos, setAgendamentos] = useState([])
  const [carregando, setCarregando]     = useState(true)
  const [erro, setErro]                 = useState('')
  const [filtro, setFiltro]             = useState('TODOS')
  const [detalhe, setDetalhe]           = useState(null)
  const [modo, setModo]                 = useState(null) // 'cancelar' | 'reagendar'

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
    try {
      await db.rpc('liberar_vaga', { p_slot_id: ag.slot_id })
      await db.from('agendamentos').update({
        status: 'CANCELADO', cancelado_por: sessao.servidorId,
      }).eq('id', ag.id)
      await registrarAuditoria(sessao.token, {
        operacao: 'CANCELAR_AGENDAMENTO', objeto: 'AGENDAMENTO',
        objetoId: ag.id, antes: { status: ag.status }, depois: { status: 'CANCELADO' },
      })
      setDetalhe(null); setModo(null)
      await carregar()
    } catch (e) { setErro(traduzirErro(e)) }
  }

  async function reagendar(ag, novoSlotId, novaData, novaHora) {
    try {
      // 1. Reservar novo slot atomicamente
      const { data: reserva, error: resErr } = await db
        .rpc('reservar_vaga', { p_slot_id: novoSlotId })
      if (resErr) throw resErr
      if (!reserva) { setErro('Horário escolhido não tem mais vagas.'); return }

      // 2. Liberar slot anterior
      await db.rpc('liberar_vaga', { p_slot_id: ag.slot_id })

      // 3. Atualizar agendamento — status volta para AGENDADO
      await db.from('agendamentos').update({
        slot_id:      novoSlotId,
        status:       'AGENDADO',
        reagendado_de: ag.id,
      }).eq('id', ag.id)

      await registrarAuditoria(sessao.token, {
        operacao: 'REAGENDAR_AGENDAMENTO', objeto: 'AGENDAMENTO',
        objetoId: ag.id,
        antes:  { slot_id: ag.slot_id, status: ag.status },
        depois: { slot_id: novoSlotId, status: 'AGENDADO' },
      })

      setDetalhe(null); setModo(null)
      await carregar()
    } catch (e) { setErro(traduzirErro(e)) }
  }

  const filtrados = filtro === 'TODOS'
    ? agendamentos
    : agendamentos.filter(a => a.status === filtro)

  if (detalhe) {
    return (
      <DetalheAgendamento
        ag={detalhe}
        modo={modo}
        setModo={setModo}
        onVoltar={() => { setDetalhe(null); setModo(null); setErro('') }}
        onCancelar={() => cancelar(detalhe)}
        onReagendar={(slotId, data, hora) => reagendar(detalhe, slotId, data, hora)}
        db={db}
        erro={erro}
        setErro={setErro}
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
        <div style={{ ...card, padding: '12px 14px',
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
            <p style={{ color: 'var(--texto-3)', marginBottom: 20 }}>Nenhum agendamento encontrado.</p>
            <Botao variante="verde" onClick={() => setPagina('agendamento')}>Novo Agendamento</Botao>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map(ag => {
            const st = STATUS_LABEL[ag.status] ?? { txt: ag.status, cor: '#888' }
            return (
              <button key={ag.id} onClick={() => { setDetalhe(ag); setModo(null); setErro('') }}
                style={{ ...card, padding: '16px 18px', cursor: 'pointer',
                  textAlign: 'left', width: '100%', marginBottom: 0,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  fontFamily: 'var(--fonte-corpo)', transition: 'border-color 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--verde)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--borda)'}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--texto)', fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>
                    {ag.nome_agendado}
                  </p>
                  <p style={{ color: 'var(--texto-3)', fontSize: '0.78rem' }}>
                    {ag.slot ? `${fmtData(ag.slot.data)} às ${ag.slot.hora?.slice(0,5)}` : '—'}
                    {ag.tipo_pessoa === 'DEPENDENTE' && ag.dependente &&
                      ` · ${ag.dependente.parentesco === 'CONJUGE' ? 'Cônjuge' : 'Filho(a)'}`}
                  </p>
                </div>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, padding: '4px 10px',
                  borderRadius: 20, background: `${st.cor}15`, color: st.cor,
                  border: `1px solid ${st.cor}40`, whiteSpace: 'nowrap', marginLeft: 12,
                }}>
                  {st.txt}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DetalheAgendamento({ ag, modo, setModo, onVoltar, onCancelar, onReagendar, db, erro, setErro }) {
  const st = STATUS_LABEL[ag.status] ?? { txt: ag.status, cor: '#888' }
  const [confirmaCancelar, setConfirmaCancelar] = useState(false)
  const [cancelando, setCancelando]   = useState(false)
  const [reagendando, setReagendando] = useState(false)

  // Reagendar
  const [dataSel, setDataSel]   = useState('')
  const [slots, setSlots]       = useState([])
  const [slotSel, setSlotSel]   = useState(null)
  const [carregandoSlots, setCarregandoSlots] = useState(false)

  useEffect(() => {
    if (modo !== 'reagendar' || !dataSel) return
    setSlots([]); setSlotSel(null); setCarregandoSlots(true)
    db.from('slots')
      .select('id, hora, capacidade, ocupacao_atual')
      .eq('data', dataSel).eq('ativo', true).order('hora')
      .then(({ data }) => {
        setCarregandoSlots(false)
        // Excluir slot atual da lista
        setSlots((data ?? []).filter(s => s.id !== ag.slot_id))
      })
  }, [dataSel, modo])

  async function handleCancelar() {
    setCancelando(true)
    await onCancelar()
    setCancelando(false)
  }

  async function handleReagendar() {
    if (!slotSel) { setErro('Selecione um horário.'); return }
    setReagendando(true)
    await onReagendar(slotSel.id, dataSel, slotSel.hora)
    setReagendando(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={onVoltar} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff' }}>Detalhes</h2>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>
        {erro && <div style={{ marginBottom: 14 }}><Alerta tipo="erro">{erro}</Alerta></div>}

        {/* Status */}
        <div style={{ background: '#fff', border: `1.5px solid ${st.cor}40`,
          borderRadius: 'var(--raio-lg)', padding: '14px 18px',
          marginBottom: 14, boxShadow: 'var(--sombra)',
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: st.cor }}/>
          <span style={{ color: st.cor, fontWeight: 700 }}>{st.txt}</span>
        </div>

        {/* Dados */}
        <div style={{ background: '#fff', border: '1.5px solid var(--borda)',
          borderRadius: 'var(--raio-lg)', padding: '18px',
          marginBottom: 14, boxShadow: 'var(--sombra)' }}>
          {[
            ['Nome',    ag.nome_agendado],
            ['CPF',     formatarCPF(ag.cpf_agendado)],
            ['Tipo',    ag.tipo_pessoa === 'SERVIDOR' ? 'Titular' :
                        ag.dependente?.parentesco === 'CONJUGE' ? 'Cônjuge' : 'Filho(a)'],
            ['Data',    ag.slot ? fmtData(ag.slot.data) : '—'],
            ['Horário', ag.slot?.hora?.slice(0,5) ?? '—'],
          ].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid var(--borda)' }}>
              <span style={{ color: 'var(--texto-3)', fontSize: '0.82rem' }}>{k}</span>
              <span style={{ color: 'var(--texto)', fontSize: '0.88rem', fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* QRCode */}
        {ag.status === 'AGENDADO' && modo === null && (
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

        {/* Ações principais */}
        {ag.status === 'AGENDADO' && modo === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Botao variante="verde" onClick={() => setModo('reagendar')}>
              ↺ Reagendar
            </Botao>
            <Botao variante="perigo" onClick={() => setConfirmaCancelar(true)}>
              Cancelar Agendamento
            </Botao>
          </div>
        )}

        {/* Confirmar cancelamento */}
        {confirmaCancelar && modo === null && (
          <div style={{ background: '#FDF2F2', border: '1.5px solid var(--vermelho)',
            borderRadius: 'var(--raio-lg)', padding: '18px' }}>
            <p style={{ color: 'var(--texto)', marginBottom: 14, fontSize: '0.88rem', lineHeight: 1.5 }}>
              Confirma o cancelamento? A vaga será liberada imediatamente.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <Botao variante="perigo" carregando={cancelando} onClick={handleCancelar}>
                Sim, cancelar
              </Botao>
              <Botao variante="secundario" onClick={() => setConfirmaCancelar(false)}>Não</Botao>
            </div>
          </div>
        )}

        {/* Reagendar */}
        {modo === 'reagendar' && (
          <div style={{ background: '#fff', border: '1.5px solid var(--borda)',
            borderRadius: 'var(--raio-lg)', padding: '20px', boxShadow: 'var(--sombra)' }}>
            <p style={{ fontFamily: 'var(--fonte-titulo)', fontWeight: 600,
              color: 'var(--texto)', marginBottom: 16 }}>Escolha nova data e horário</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {DATAS.map(d => (
                <button key={d.valor} onClick={() => { setDataSel(d.valor); setSlotSel(null) }}
                  style={{ padding: '12px 16px', borderRadius: 10,
                    border: `2px solid ${dataSel===d.valor ? 'var(--verde)' : 'var(--borda)'}`,
                    background: dataSel===d.valor ? 'var(--verde-claro)' : '#fff',
                    color: dataSel===d.valor ? 'var(--verde)' : 'var(--texto-2)',
                    fontFamily: 'var(--fonte-corpo)', fontSize: '0.88rem',
                    fontWeight: dataSel===d.valor ? 700 : 400,
                    textAlign: 'left', cursor: 'pointer' }}>
                  {d.label}
                </button>
              ))}
            </div>

            {carregandoSlots && (
              <p style={{ color: 'var(--texto-3)', fontSize: '0.82rem', textAlign: 'center', padding: 12 }}>
                Carregando horários...
              </p>
            )}

            {!carregandoSlots && slots.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                {slots.filter(s => s.ocupacao_atual < s.capacidade).map(s => (
                  <button key={s.id} onClick={() => setSlotSel(s)} style={{
                    padding: '11px 4px', borderRadius: 10,
                    border: `2px solid ${slotSel?.id===s.id ? 'var(--verde)' : 'var(--borda)'}`,
                    background: slotSel?.id===s.id ? 'var(--verde-claro)' : '#fff',
                    cursor: 'pointer', textAlign: 'center',
                  }}>
                    <span style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.9rem',
                      fontWeight: 700, color: slotSel?.id===s.id ? 'var(--verde)' : 'var(--texto)',
                      display: 'block' }}>
                      {s.hora.slice(0,5)}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--texto-3)' }}>
                      {s.capacidade - s.ocupacao_atual} vaga(s)
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Botao variante="verde" carregando={reagendando} onClick={handleReagendar}
                desabilitado={!slotSel}>
                Confirmar Reagendamento
              </Botao>
              <Botao variante="secundario" onClick={() => { setModo(null); setDataSel(''); setSlotSel(null) }}>
                Cancelar
              </Botao>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
