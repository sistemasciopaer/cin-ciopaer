import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { formatarCPF } from '@/lib/cpf'
import { traduzirErro } from '@/lib/erros'
import { registrarAuditoria } from '@/modules/audit/auditRepository'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Alerta } from '@/components/ui/Alerta'

function fmtData(d) {
  if (!d) return ''
  const [y,m,dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

export function ConfirmarPresenca() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [aba, setAba]                     = useState('scanner') // scanner | busca
  const [busca, setBusca]                 = useState('')
  const [agendamento, setAgendamento]     = useState(null)
  const [carregando, setCarregando]       = useState(false)
  const [confirmando, setConfirmando]     = useState(false)
  const [erro, setErro]                   = useState('')
  const [sucesso, setSucesso]             = useState('')
  const [scannerAtivo, setScannerAtivo]   = useState(false)
  const [codigoManual, setCodigoManual]   = useState('')
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)

  // ── Iniciar scanner ──────────────────────────────────────
  useEffect(() => {
    if (aba !== 'scanner') {
      pararScanner()
      return
    }
    iniciarScanner()
    return () => pararScanner()
  }, [aba])

  async function iniciarScanner() {
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (!scannerRef.current) return
      html5QrRef.current = new Html5Qrcode('qr-reader')
      await html5QrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => { pararScanner(); buscarPorCodigo(decoded.trim()) },
        () => {}
      )
      setScannerAtivo(true)
    } catch (e) {
      setScannerAtivo(false)
      setErro('Câmera não disponível. Use a busca manual abaixo.')
    }
  }

  async function pararScanner() {
    try {
      if (html5QrRef.current) {
        await html5QrRef.current.stop()
        html5QrRef.current = null
      }
    } catch (_) {}
    setScannerAtivo(false)
  }

  // ── Buscar agendamento ───────────────────────────────────
  async function buscarPorCodigo(codigo) {
    setErro(''); setAgendamento(null); setSucesso('')
    setCarregando(true)
    const { data, error } = await db
      .from('agendamentos')
      .select(`id, nome_agendado, cpf_agendado, tipo_pessoa, status, qr_code, email_destino,
               slot:slots(data, hora),
               responsavel:servidores!servidor_responsavel_id(nome, matricula)`)
      .eq('qr_code', codigo.trim())
      .maybeSingle()
    setCarregando(false)
    if (error || !data) { setErro('Agendamento não encontrado para este código.'); return }
    setAgendamento(data)
  }

  async function buscarPorTexto() {
    if (!busca.trim()) return
    setErro(''); setAgendamento(null); setSucesso('')
    setCarregando(true)
    const termo = busca.trim()
    const cpfLimpo = termo.replace(/\D/g, '')

    let query = db
      .from('agendamentos')
      .select(`id, nome_agendado, cpf_agendado, tipo_pessoa, status, qr_code, email_destino,
               slot:slots(data, hora),
               responsavel:servidores!servidor_responsavel_id(nome, matricula)`)
      .order('criado_em', { ascending: false })
      .limit(5)

    if (cpfLimpo.length >= 6) {
      query = query.ilike('cpf_agendado', `%${cpfLimpo}%`)
    } else {
      query = query.ilike('nome_agendado', `%${termo}%`)
    }

    const { data, error } = await query
    setCarregando(false)
    if (error) { setErro('Erro na busca.'); return }
    if (!data || data.length === 0) { setErro('Nenhum agendamento encontrado.'); return }
    if (data.length === 1) { setAgendamento(data[0]); return }
    setAgendamento({ multiplos: data })
  }

  // ── Confirmar presença ───────────────────────────────────
  async function confirmarPresenca() {
    if (!agendamento?.id) return
    setConfirmando(true); setErro('')

    if (agendamento.status !== 'AGENDADO') {
      setErro(`Este agendamento está com status "${agendamento.status}" e não pode ter presença confirmada.`)
      setConfirmando(false); return
    }

    try {
      await db.from('presencas').insert({
        agendamento_id: agendamento.id,
        confirmado_por: sessao.servidorId,
        metodo: aba === 'scanner' ? 'QRCODE' : 'PESQUISA',
      })
      await db.from('agendamentos').update({ status: 'PRESENTE' }).eq('id', agendamento.id)
      await registrarAuditoria(sessao.token, {
        operacao: 'CONFIRMAR_PRESENCA', objeto: 'PRESENCA',
        objetoId: agendamento.id,
        depois: { metodo: aba === 'scanner' ? 'QRCODE' : 'PESQUISA', confirmadoPor: sessao.servidorId }
      })
      setSucesso(`Presença de ${agendamento.nome_agendado} confirmada com sucesso!`)
      setAgendamento(null)
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setConfirmando(false)
    }
  }

  function limpar() {
    setAgendamento(null); setErro(''); setSucesso('')
    setBusca(''); setCodigoManual('')
    if (aba === 'scanner') iniciarScanner()
  }

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24, padding: 0,
      }}>← Voltar</button>

      <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.4rem',
        fontWeight: 700, color: '#fff', marginBottom: 20 }}>
        Confirmar Presença
      </h2>

      {sucesso && (
        <div style={{ marginBottom: 20 }}>
          <Alerta tipo="sucesso">{sucesso}</Alerta>
          <div style={{ marginTop: 12 }}>
            <Botao onClick={limpar}>Confirmar outro</Botao>
          </div>
        </div>
      )}

      {!sucesso && (
        <>
          {/* Abas */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24,
            background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: 4 }}>
            {[
              { val: 'scanner', label: '📷  Scanner QR' },
              { val: 'busca',   label: '🔍  Busca manual' },
            ].map(a => (
              <button key={a.val} onClick={() => { setAba(a.val); setAgendamento(null); setErro('') }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  background: aba === a.val ? 'var(--verde-base)' : 'transparent',
                  color: aba === a.val ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontFamily: 'var(--fonte-corpo)', fontSize: '0.85rem',
                  fontWeight: aba === a.val ? 600 : 400,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {a.label}
              </button>
            ))}
          </div>

          {/* Scanner */}
          {aba === 'scanner' && (
            <div style={{ marginBottom: 20 }}>
              <div id="qr-reader" ref={scannerRef} style={{
                width: '100%', borderRadius: 14, overflow: 'hidden',
                border: '2px solid rgba(0,128,61,0.3)',
                background: 'rgba(0,0,0,0.4)', minHeight: 280,
              }}/>
              {!scannerAtivo && !carregando && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: 12, textAlign: 'center' }}>
                    Ou insira o código manualmente:
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <Campo type="text" value={codigoManual}
                        onChange={e => setCodigoManual(e.target.value)}
                        placeholder="QR-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        onKeyDown={e => e.key === 'Enter' && buscarPorCodigo(codigoManual)} />
                    </div>
                    <button onClick={() => buscarPorCodigo(codigoManual)}
                      style={{ background: 'var(--verde-base)', color: '#fff', border: 'none',
                        borderRadius: 8, padding: '0 16px', cursor: 'pointer', fontFamily: 'var(--fonte-corpo)', fontWeight: 600 }}>
                      Buscar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Busca manual */}
          {aba === 'busca' && (
            <div style={{ marginBottom: 20 }}>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginBottom: 12 }}>
                Busque por nome ou CPF do agendado:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <Campo type="text" value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Nome ou CPF"
                    onKeyDown={e => e.key === 'Enter' && buscarPorTexto()} />
                </div>
                <button onClick={buscarPorTexto}
                  style={{ background: 'var(--verde-base)', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '0 16px', cursor: 'pointer',
                    fontFamily: 'var(--fonte-corpo)', fontWeight: 600 }}>
                  Buscar
                </button>
              </div>
            </div>
          )}

          {carregando && (
            <p style={{ color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: 20 }}>Buscando...</p>
          )}

          {erro && <div style={{ marginBottom: 16 }}><Alerta tipo="erro">{erro}</Alerta></div>}

          {/* Múltiplos resultados */}
          {agendamento?.multiplos && (
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', marginBottom: 12 }}>
                {agendamento.multiplos.length} resultados — selecione:
              </p>
              {agendamento.multiplos.map(ag => (
                <button key={ag.id} onClick={() => setAgendamento(ag)}
                  style={{ width: '100%', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
                    padding: '14px 16px', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
                    fontFamily: 'var(--fonte-corpo)', color: '#fff', }}>
                  <strong style={{ fontSize: '0.9rem' }}>{ag.nome_agendado}</strong><br/>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>
                    {formatarCPF(ag.cpf_agendado)} · {ag.slot ? `${fmtData(ag.slot.data)} ${ag.slot.hora?.slice(0,5)}` : '—'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Agendamento encontrado */}
          {agendamento && !agendamento.multiplos && (
            <div>
              <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: 20, marginBottom: 16 }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Agendamento localizado
                </p>
                {[
                  ['Nome', agendamento.nome_agendado],
                  ['CPF', formatarCPF(agendamento.cpf_agendado)],
                  ['Data', agendamento.slot ? fmtData(agendamento.slot.data) : '—'],
                  ['Horário', agendamento.slot?.hora?.slice(0,5) ?? '—'],
                  ['Responsável', agendamento.responsavel?.nome ?? '—'],
                  ['Status', agendamento.status],
                ].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>{k}</span>
                    <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {agendamento.status === 'AGENDADO' ? (
                <Botao onClick={confirmarPresenca} carregando={confirmando}>
                  ✓ Confirmar Presença
                </Botao>
              ) : (
                <Alerta tipo="info">
                  Este agendamento está com status <strong>{agendamento.status}</strong> e não pode ter presença confirmada.
                </Alerta>
              )}

              <div style={{ marginTop: 10 }}>
                <Botao variante="secundario" onClick={limpar}>Limpar</Botao>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
