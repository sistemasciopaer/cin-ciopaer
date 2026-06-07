import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { traduzirErro } from '@/lib/erros'
import { registrarAuditoria } from '@/modules/audit/auditRepository'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Alerta } from '@/components/ui/Alerta'

const DATAS = ['2026-06-15', '2026-06-16']

function fmtData(d) {
  if (!d) return ''
  const [y,m,dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

const card = {
  background: '#fff', border: '1.5px solid var(--borda)',
  borderRadius: 'var(--raio-lg)', padding: '20px',
  marginBottom: 14, boxShadow: 'var(--sombra)',
}

export function SlotsExtra() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [slots, setSlots]         = useState([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando]   = useState(false)
  const [erro, setErro]           = useState('')
  const [sucesso, setSucesso]     = useState('')

  const [data, setData]           = useState('2026-06-15')
  const [hora, setHora]           = useState('')
  const [capacidade, setCapacidade] = useState('5')
  const [motivo, setMotivo]       = useState('')
  const [erros, setErros]         = useState({})

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    const { data: sl } = await db.from('slots')
      .select('id, data, hora, capacidade, ocupacao_atual, slot_extra, motivo_criacao')
      .order('data').order('hora')
    setCarregando(false)
    setSlots(sl ?? [])
  }

  function validar() {
    const e = {}
    if (!hora)    e.hora   = 'Informe o horário.'
    if (!motivo.trim()) e.motivo = 'Informe o motivo.'
    const cap = parseInt(capacidade)
    if (isNaN(cap) || cap < 1 || cap > 20) e.capacidade = 'Entre 1 e 20.'
    setErros(e)
    return Object.keys(e).length === 0
  }

  async function criarSlot() {
    if (!validar()) return
    setSalvando(true); setErro(''); setSucesso('')
    try {
      const { data: novoSlot, error } = await db.from('slots').insert({
        data,
        hora:           hora + ':00',
        numero_slot:    slots.filter(s => s.data === data).length + 1,
        capacidade:     parseInt(capacidade),
        ocupacao_atual: 0,
        slot_extra:     true,
        criado_por:     sessao.servidorId,
        motivo_criacao: motivo.trim(),
        ativo:          true,
      }).select('id').single()

      if (error) throw error

      await registrarAuditoria(sessao.token, {
        operacao: 'CRIAR_SLOT_EXTRA', objeto: 'SLOT',
        objetoId: novoSlot.id,
        depois: { data, hora, capacidade, motivo },
      })

      setSucesso(`Slot ${hora} do dia ${fmtData(data)} criado com sucesso.`)
      setHora(''); setMotivo(''); setCapacidade('5')
      await carregar()
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setSalvando(false)
    }
  }

  const slotsExtras   = slots.filter(s => s.slot_extra)
  const slotsNormais  = slots.filter(s => !s.slot_extra)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={() => setPagina('admin')} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff' }}>
          Slots Extras
        </h2>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>

        {erro    && <div style={{ marginBottom: 14 }}><Alerta tipo="erro">{erro}</Alerta></div>}
        {sucesso && <div style={{ marginBottom: 14 }}><Alerta tipo="sucesso">{sucesso}</Alerta></div>}

        {/* Criar slot */}
        <div style={card}>
          <p style={{ fontFamily: 'var(--fonte-titulo)', fontWeight: 600,
            color: 'var(--texto)', marginBottom: 16, fontSize: '0.95rem' }}>
            Criar novo slot extra
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Data */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--texto-2)',
                letterSpacing: '0.06em', textTransform: 'uppercase',
                fontWeight: 600, display: 'block', marginBottom: 8 }}>Data</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {DATAS.map(d => (
                  <button key={d} onClick={() => setData(d)} style={{
                    flex: 1, padding: '11px 8px', borderRadius: 10,
                    border: `2px solid ${data===d ? 'var(--verde)' : 'var(--borda)'}`,
                    background: data===d ? 'var(--verde-claro)' : '#fff',
                    color: data===d ? 'var(--verde)' : 'var(--texto-2)',
                    fontFamily: 'var(--fonte-corpo)', fontSize: '0.82rem',
                    fontWeight: data===d ? 700 : 400, cursor: 'pointer',
                  }}>
                    {fmtData(d)}
                  </button>
                ))}
              </div>
            </div>

            {/* Hora e capacidade */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Campo label="Horário" type="time" value={hora}
                onChange={e => setHora(e.target.value)} erro={erros.hora} />
              <Campo label="Vagas" type="number" value={capacidade} min="1" max="20"
                onChange={e => setCapacidade(e.target.value)} erro={erros.capacidade} />
            </div>

            <Campo label="Motivo" type="text" value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Reposição de vagas, demanda extra..."
              erro={erros.motivo} />

            <Botao variante="verde" onClick={criarSlot} carregando={salvando}>
              Criar slot extra
            </Botao>
          </div>
        </div>

        {/* Slots extras existentes */}
        {slotsExtras.length > 0 && (
          <div style={card}>
            <p style={{ fontFamily: 'var(--fonte-titulo)', fontWeight: 600,
              color: 'var(--texto)', marginBottom: 14, fontSize: '0.88rem' }}>
              Slots extras criados ({slotsExtras.length})
            </p>
            {slotsExtras.map(s => (
              <div key={s.id} style={{ padding: '10px 0',
                borderBottom: '1px solid var(--borda)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, color: 'var(--texto)', fontSize: '0.88rem' }}>
                    {fmtData(s.data)} às {s.hora.slice(0,5)}
                  </span>
                  <p style={{ color: 'var(--texto-3)', fontSize: '0.75rem', marginTop: 2 }}>
                    {s.motivo_criacao} · {s.ocupacao_atual}/{s.capacidade} vagas
                  </p>
                </div>
                <span style={{ fontSize: '0.72rem', padding: '3px 10px', borderRadius: 20,
                  background: 'var(--laranja-claro)', color: 'var(--laranja)',
                  border: '1px solid var(--laranja)', whiteSpace: 'nowrap' }}>
                  Extra
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Resumo slots normais */}
        <div style={card}>
          <p style={{ fontFamily: 'var(--fonte-titulo)', fontWeight: 600,
            color: 'var(--texto)', marginBottom: 14, fontSize: '0.88rem' }}>
            Ocupação atual — slots normais
          </p>
          {carregando ? (
            <p style={{ color: 'var(--texto-3)', fontSize: '0.82rem' }}>Carregando...</p>
          ) : (
            slotsNormais.map(s => {
              const pct = Math.round((s.ocupacao_atual / s.capacidade) * 100)
              return (
                <div key={s.id} style={{ padding: '8px 0',
                  borderBottom: '1px solid var(--borda)',
                  display: 'grid', gridTemplateColumns: '70px 70px 1fr 50px',
                  alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--texto-3)', fontSize: '0.75rem' }}>{fmtData(s.data)}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700,
                    color: 'var(--texto)', fontSize: '0.88rem' }}>
                    {s.hora.slice(0,5)}
                  </span>
                  <div style={{ background: 'var(--borda)', borderRadius: 3, height: 6 }}>
                    <div style={{ height: '100%', borderRadius: 3, width: `${pct}%`,
                      background: pct >= 100 ? 'var(--vermelho)' :
                                  pct > 60  ? 'var(--laranja)' : 'var(--verde)',
                      transition: 'width 0.3s' }}/>
                  </div>
                  <span style={{ color: 'var(--texto-3)', fontSize: '0.72rem', textAlign: 'right' }}>
                    {s.ocupacao_atual}/{s.capacidade}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
