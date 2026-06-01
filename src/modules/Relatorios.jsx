import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { Alerta } from '@/components/ui/Alerta'

function fmtData(d) {
  if (!d) return ''
  const [y,m,dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

const CORES = {
  AGENDADO:   '#00803D',
  PRESENTE:   '#2ecc71',
  CANCELADO:  '#e74c3c',
  REAGENDADO: '#f39c12',
  NO_SHOW:    '#95a5a6',
}

export function Relatorios() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [dados, setDados]         = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro]           = useState('')
  const [filtroData, setFiltroData] = useState('TODOS')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const { data: ags, error } = await db
        .from('agendamentos')
        .select('id, status, tipo_pessoa, slot:slots(data, hora)')

      if (error) throw error

      const { data: slots } = await db
        .from('slots')
        .select('id, data, hora, capacidade, ocupacao_atual')
        .order('data').order('hora')

      setDados({ agendamentos: ags ?? [], slots: slots ?? [] })
    } catch (e) {
      setErro('Erro ao carregar dados.')
    } finally {
      setCarregando(false)
    }
  }

  if (carregando) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20 }}>
      <p style={{ color: 'rgba(255,255,255,0.35)' }}>Carregando relatórios...</p>
    </div>
  )

  if (!dados) return null

  const { agendamentos, slots } = dados

  const filtrarPorData = (lista) => {
    if (filtroData === 'TODOS') return lista
    return lista.filter(a => a.slot?.data === filtroData)
  }

  const ags = filtrarPorData(agendamentos)

  const contagem = (status) => ags.filter(a => a.status === status).length
  const total    = ags.length

  const cards = [
    { label: 'Total',        valor: total,              cor: '#fff',             icon: '📋' },
    { label: 'Agendados',    valor: contagem('AGENDADO'),    cor: CORES.AGENDADO,  icon: '📅' },
    { label: 'Presentes',    valor: contagem('PRESENTE'),    cor: CORES.PRESENTE,  icon: '✓'  },
    { label: 'Cancelados',   valor: contagem('CANCELADO'),   cor: CORES.CANCELADO, icon: '✗'  },
    { label: 'Não compareceu', valor: contagem('NO_SHOW'),   cor: CORES.NO_SHOW,   icon: '⏱'  },
    { label: 'Reagendados',  valor: contagem('REAGENDADO'),  cor: CORES.REAGENDADO,icon: '↺'  },
  ]

  // Por hora
  const slotsFiltrados = filtroData === 'TODOS'
    ? slots
    : slots.filter(s => s.data === filtroData)

  const porHora = slotsFiltrados.map(slot => {
    const agsSlot = ags.filter(a => a.slot?.hora === slot.hora && a.slot?.data === slot.data)
    return {
      hora:       slot.hora.slice(0,5),
      data:       slot.data,
      capacidade: slot.capacidade,
      ocupados:   slot.ocupacao_atual,
      presentes:  agsSlot.filter(a => a.status === 'PRESENTE').length,
      agendados:  agsSlot.filter(a => a.status === 'AGENDADO').length,
      cancelados: agsSlot.filter(a => a.status === 'CANCELADO').length,
    }
  })

  const datas = [...new Set(slots.map(s => s.data))].sort()

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 560, margin: '0 auto' }}>
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24, padding: 0,
      }}>← Voltar</button>

      <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.4rem',
        fontWeight: 700, color: '#fff', marginBottom: 20 }}>
        Relatórios
      </h2>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      {/* Filtro por data */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[{ v: 'TODOS', l: 'Ambos os dias' }, ...datas.map(d => ({ v: d, l: fmtData(d) }))].map(op => (
          <button key={op.v} onClick={() => setFiltroData(op.v)} style={{
            padding: '7px 14px', borderRadius: 20,
            border: `1.5px solid ${filtroData === op.v ? 'var(--verde-base)' : 'rgba(255,255,255,0.12)'}`,
            background: filtroData === op.v ? 'rgba(0,128,61,0.15)' : 'transparent',
            color: filtroData === op.v ? '#fff' : 'rgba(255,255,255,0.45)',
            fontFamily: 'var(--fonte-corpo)', fontSize: '0.78rem',
            fontWeight: filtroData === op.v ? 600 : 400, cursor: 'pointer',
          }}>{op.l}</button>
        ))}
      </div>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 28 }}>
        {cards.map(c => (
          <div key={c.label} style={{
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${c.cor}22`,
            borderRadius: 12, padding: '16px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.6rem',
              fontWeight: 700, color: c.cor, lineHeight: 1 }}>
              {c.valor}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem',
              marginTop: 4, letterSpacing: '0.04em' }}>
              {c.label}
            </div>
          </div>
        ))}
      </div>

      {/* Tabela por horário */}
      <div>
        <p style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.78rem', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
          Ocupação por horário
        </p>
        <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: filtroData === 'TODOS' ? '80px 80px 1fr 60px 60px 60px' : '80px 1fr 60px 60px 60px',
            padding: '10px 16px', background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {filtroData === 'TODOS' && <span style={thStyle}>Data</span>}
            <span style={thStyle}>Hora</span>
            <span style={thStyle}>Ocupação</span>
            <span style={{ ...thStyle, textAlign: 'center', color: CORES.PRESENTE }}>Pres.</span>
            <span style={{ ...thStyle, textAlign: 'center', color: CORES.AGENDADO }}>Ag.</span>
            <span style={{ ...thStyle, textAlign: 'center', color: CORES.CANCELADO }}>Canc.</span>
          </div>
          {porHora.map((h, i) => {
            const pct = Math.round((h.ocupados / h.capacidade) * 100)
            return (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: filtroData === 'TODOS' ? '80px 80px 1fr 60px 60px 60px' : '80px 1fr 60px 60px 60px',
                padding: '10px 16px', alignItems: 'center',
                borderBottom: i < porHora.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                {filtroData === 'TODOS' && (
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                    {fmtData(h.data)}
                  </span>
                )}
                <span style={{ color: '#fff', fontFamily: 'monospace', fontSize: '0.88rem', fontWeight: 600 }}>
                  {h.hora}
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                      <div style={{ height: '100%', borderRadius: 2,
                        width: `${pct}%`,
                        background: pct >= 100 ? CORES.CANCELADO : pct > 60 ? CORES.REAGENDADO : CORES.AGENDADO,
                        transition: 'width 0.3s',
                      }}/>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                      {h.ocupados}/{h.capacidade}
                    </span>
                  </div>
                </div>
                <span style={{ textAlign: 'center', color: CORES.PRESENTE, fontSize: '0.85rem', fontWeight: 600 }}>
                  {h.presentes || '—'}
                </span>
                <span style={{ textAlign: 'center', color: CORES.AGENDADO, fontSize: '0.85rem', fontWeight: 600 }}>
                  {h.agendados || '—'}
                </span>
                <span style={{ textAlign: 'center', color: CORES.CANCELADO, fontSize: '0.85rem', fontWeight: 600 }}>
                  {h.cancelados || '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const thStyle = {
  color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem',
  letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600,
}
