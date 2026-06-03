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

const card = {
  background: '#fff', border: '1.5px solid var(--borda)',
  borderRadius: 'var(--raio-lg)', padding: '20px',
  boxShadow: 'var(--sombra)',
}

export function ConfirmarPresenca() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [aba, setAba]               = useState('scanner')
  const [busca, setBusca]           = useState('')
  const [codigoManual, setCodigoManual] = useState('')
  const [agendamento, setAgendamento]   = useState(null)
  const [multiplos, setMultiplos]       = useState([])
  const [carregando, setCarregando]     = useState(false)
  const [confirmando, setConfirmando]   = useState(false)
  const [desfazendo, setDesfazendo]     = useState(false)
  const [erro, setErro]                 = useState('')
  const [sucesso, setSucesso]           = useState('')
  const [scannerAtivo, setScannerAtivo] = useState(false)
  const html5QrRef = useRef(null)

  useEffect(() => {
    if (aba === 'scanner') iniciarScanner()
    else pararScanner()
    return () => pararScanner()
  }, [aba])

  async function iniciarScanner() {
    setScannerAtivo(false)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const el = document.getElementById('qr-reader-v2')
      if (!el) return
      html5QrRef.current = new Html5Qrcode('qr-reader-v2')
      await html5QrRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => { pararScanner(); buscarPorCodigo(decoded.trim()) },
        () => {}
      )
      setScannerAtivo(true)
    } catch {
      setScannerAtivo(false)
    }
  }

  async function pararScanner() {
    try { if (html5QrRef.current) { await html5QrRef.current.stop(); html5QrRef.current = null } } catch {}
    setScannerAtivo(false)
  }

  async function buscarPorCodigo(codigo) {
    setErro(''); setAgendamento(null); setMultiplos([]); setSucesso('')
    setCarregando(true)
    const { data, error } = await db
      .from('agendamentos')
      .select(`id, nome_agendado, cpf_agendado, tipo_pessoa, status, qr_code, email_destino,
               slot:slots(data, hora),
               responsavel:servidores!servidor_responsavel_id(nome, matricula)`)
      .eq('qr_code', codigo.trim()).maybeSingle()
    setCarregando(false)
    if (error || !data) { setErro('QRCode não encontrado.'); return }
    setAgendamento(data)
  }

  async function buscarPorTexto() {
    if (!busca.trim()) return
    setErro(''); setAgendamento(null); setMultiplos([]); setSucesso('')
    setCarregando(true)
    const cpfLimpo = busca.replace(/\D/g,'')
    let q = db.from('agendamentos')
      .select(`id, nome_agendado, cpf_agendado, tipo_pessoa, status, qr_code,
               slot:slots(data, hora),
               responsavel:servidores!servidor_responsavel_id(nome, matricula)`)
      .order('criado_em', { ascending: false }).limit(5)
    if (cpfLimpo.length >= 6) q = q.ilike('cpf_agendado', `%${cpfLimpo}%`)
    else                       q = q.ilike('nome_agendado', `%${busca.trim()}%`)
    const { data, error } = await q
    setCarregando(false)
    if (error || !data?.length) { setErro('Nenhum agendamento encontrado.'); return }
    if (data.length === 1) setAgendamento(data[0])
    else setMultiplos(data)
  }

  async function confirmarPresenca() {
    if (!agendamento?.id || agendamento.status !== 'AGENDADO') return
    setConfirmando(true); setErro('')
    try {
      await db.from('presencas').insert({
        agendamento_id: agendamento.id,
        confirmado_por: sessao.servidorId,
        metodo: aba === 'scanner' ? 'QRCODE' : 'PESQUISA',
      })
      await db.from('agendamentos').update({ status: 'PRESENTE' }).eq('id', agendamento.id)
      await registrarAuditoria(sessao.token, {
        operacao: 'CONFIRMAR_PRESENCA', objeto: 'PRESENCA', objetoId: agendamento.id,
        depois: { metodo: aba === 'scanner' ? 'QRCODE' : 'PESQUISA' }
      })
      setSucesso(`Presença de ${agendamento.nome_agendado} confirmada!`)
      setAgendamento(null)
    } catch (e) { setErro(traduzirErro(e)) }
    finally { setConfirmando(false) }
  }

  // DESFAZER presença — volta para AGENDADO
  async function desfazerPresenca() {
    if (!agendamento?.id || agendamento.status !== 'PRESENTE') return
    setDesfazendo(true); setErro('')
    try {
      await db.from('presencas').delete().eq('agendamento_id', agendamento.id)
      await db.from('agendamentos').update({ status: 'AGENDADO' }).eq('id', agendamento.id)
      await registrarAuditoria(sessao.token, {
        operacao: 'DESFAZER_PRESENCA', objeto: 'AGENDAMENTO', objetoId: agendamento.id,
        antes: { status: 'PRESENTE' }, depois: { status: 'AGENDADO' }
      })
      setSucesso(`Presença de ${agendamento.nome_agendado} desfeita. Status voltou para AGENDADO.`)
      setAgendamento(null)
    } catch (e) { setErro(traduzirErro(e)) }
    finally { setDesfazendo(false) }
  }

  function limpar() {
    setAgendamento(null); setMultiplos([]); setErro(''); setSucesso('')
    setBusca(''); setCodigoManual('')
    if (aba === 'scanner') iniciarScanner()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>

      {/* Header verde */}
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={() => setPagina('dashboard')} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff' }}>
          Confirmar Presença
        </h2>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>

        {/* Abas */}
        <div style={{ ...card, padding: '6px', marginBottom: 16,
          display: 'flex', gap: 4 }}>
          {[
            { val: 'scanner', label: '📷 Scanner QR' },
            { val: 'busca',   label: '🔍 Busca' },
          ].map(a => (
            <button key={a.val} onClick={() => { setAba(a.val); limpar() }}
              style={{ flex: 1, padding: '10px', borderRadius: 10,
                background: aba === a.val ? 'var(--verde)' : 'transparent',
                color: aba === a.val ? '#fff' : 'var(--texto-2)',
                fontFamily: 'var(--fonte-corpo)', fontSize: '0.88rem',
                fontWeight: aba === a.val ? 600 : 400,
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {a.label}
            </button>
          ))}
        </div>

        {sucesso && (
          <div style={{ marginBottom: 16 }}>
            <Alerta tipo="sucesso">{sucesso}</Alerta>
            <div style={{ marginTop: 10 }}>
              <Botao variante="verde" onClick={limpar}>Confirmar outro</Botao>
            </div>
          </div>
        )}

        {!sucesso && (
          <>
            {/* Scanner */}
            {aba === 'scanner' && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div id="qr-reader-v2" style={{ width: '100%', borderRadius: 12,
                  overflow: 'hidden', minHeight: 260,
                  border: '2px solid var(--verde-claro)',
                  background: '#f8f8f8' }}/>
                {!scannerAtivo && (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ color: 'var(--texto-3)', fontSize: '0.82rem',
                      marginBottom: 10, textAlign: 'center' }}>
                      Câmera indisponível — insira o código manualmente:
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <Campo type="text" value={codigoManual}
                          onChange={e => setCodigoManual(e.target.value)}
                          placeholder="QR-xxxxxxxxxxxxxxxx"
                          onKeyDown={e => e.key === 'Enter' && buscarPorCodigo(codigoManual)} />
                      </div>
                      <button onClick={() => buscarPorCodigo(codigoManual)}
                        style={{ background: 'var(--laranja)', color: '#fff', border: 'none',
                          borderRadius: 10, padding: '0 16px', cursor: 'pointer',
                          fontFamily: 'var(--fonte-corpo)', fontWeight: 600, fontSize: '0.88rem' }}>
                        Buscar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Busca manual */}
            {aba === 'busca' && (
              <div style={{ ...card, marginBottom: 16 }}>
                <p style={{ color: 'var(--texto-2)', fontSize: '0.82rem', marginBottom: 12 }}>
                  Busque por nome ou CPF:
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <Campo type="text" value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Nome ou CPF"
                      onKeyDown={e => e.key === 'Enter' && buscarPorTexto()} />
                  </div>
                  <button onClick={buscarPorTexto}
                    style={{ background: 'var(--laranja)', color: '#fff', border: 'none',
                      borderRadius: 10, padding: '0 18px', cursor: 'pointer',
                      fontFamily: 'var(--fonte-corpo)', fontWeight: 600, fontSize: '0.88rem' }}>
                    Buscar
                  </button>
                </div>
              </div>
            )}

            {carregando && (
              <p style={{ color: 'var(--texto-3)', textAlign: 'center', padding: 20 }}>Buscando...</p>
            )}

            {erro && <div style={{ marginBottom: 14 }}><Alerta tipo="erro">{erro}</Alerta></div>}

            {/* Múltiplos */}
            {multiplos.length > 0 && (
              <div style={{ ...card, marginBottom: 14 }}>
                <p style={{ color: 'var(--texto-2)', fontSize: '0.82rem', marginBottom: 12 }}>
                  {multiplos.length} resultados — selecione:
                </p>
                {multiplos.map(ag => (
                  <button key={ag.id} onClick={() => { setAgendamento(ag); setMultiplos([]) }}
                    style={{ width: '100%', background: 'var(--bg)',
                      border: '1.5px solid var(--borda)', borderRadius: 10,
                      padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
                      marginBottom: 8, fontFamily: 'var(--fonte-corpo)' }}>
                    <strong style={{ color: 'var(--texto)', fontSize: '0.9rem' }}>
                      {ag.nome_agendado}
                    </strong><br/>
                    <span style={{ color: 'var(--texto-3)', fontSize: '0.78rem' }}>
                      {formatarCPF(ag.cpf_agendado)} · {ag.slot ? `${fmtData(ag.slot.data)} ${ag.slot.hora?.slice(0,5)}` : '—'} · {ag.status}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Agendamento encontrado */}
            {agendamento && !agendamento.multiplos && (
              <div style={{ ...card, marginBottom: 14 }}>
                <p style={{ color: 'var(--texto-3)', fontSize: '0.72rem',
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Agendamento localizado
                </p>
                {[
                  ['Nome',        agendamento.nome_agendado],
                  ['CPF',         formatarCPF(agendamento.cpf_agendado)],
                  ['Data',        agendamento.slot ? fmtData(agendamento.slot.data) : '—'],
                  ['Horário',     agendamento.slot?.hora?.slice(0,5) ?? '—'],
                  ['Responsável', agendamento.responsavel?.nome ?? '—'],
                  ['Status',      agendamento.status],
                ].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid var(--borda)' }}>
                    <span style={{ color: 'var(--texto-3)', fontSize: '0.82rem' }}>{k}</span>
                    <span style={{ color: 'var(--texto)', fontSize: '0.88rem', fontWeight: 500 }}>{v}</span>
                  </div>
                ))}

                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {agendamento.status === 'AGENDADO' && (
                    <Botao variante="verde" onClick={confirmarPresenca} carregando={confirmando}>
                      ✓ Confirmar Presença
                    </Botao>
                  )}
                  {agendamento.status === 'PRESENTE' && (
                    <Botao variante="perigo" onClick={desfazerPresenca} carregando={desfazendo}>
                      ↩ Desfazer presença (voltar para Agendado)
                    </Botao>
                  )}
                  {!['AGENDADO','PRESENTE'].includes(agendamento.status) && (
                    <Alerta tipo="aviso">
                      Status atual: <strong>{agendamento.status}</strong> — não é possível confirmar presença.
                    </Alerta>
                  )}
                  <Botao variante="secundario" onClick={limpar}>Limpar</Botao>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
