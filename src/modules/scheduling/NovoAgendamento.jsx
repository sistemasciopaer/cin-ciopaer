import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { normalizarCPF, validarCPF } from '@/lib/cpf'
import { gerarQRCodeId } from '@/lib/token'
import { traduzirErro } from '@/lib/erros'
import { registrarAuditoria } from '@/modules/audit/auditRepository'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Alerta } from '@/components/ui/Alerta'

const DATAS = [
  { valor: '2026-06-15', label: '15 de junho de 2026 (segunda-feira)' },
  { valor: '2026-06-16', label: '16 de junho de 2026 (terça-feira)' },
]

// Apenas FILHO e CÔNJUGE — genitor removido
const PARENTESCOS = [
  { valor: 'FILHO',   label: 'Filho(a)' },
  { valor: 'CONJUGE', label: 'Cônjuge'  },
  { valor: 'GENITOR', label: 'Genitor(a)'},
]

const DOCS_TEXTO = `Conforme o Decreto nº 10.977/2022, é obrigatória a apresentação da certidão original, em meio físico ou digital, emitida pelo cartório competente:

• Solteiros: Certidão de Nascimento
• Casados: Certidão de Casamento
• Divorciados: Certidão de Casamento com averbação do divórcio
• Viúvos: Certidão de Casamento com averbação do óbito do cônjuge

Opcionalmente, mediante apresentação da documentação comprobatória:
• Título de Eleitor
• Tipo Sanguíneo
• Carteira Nacional de Habilitação (CNH)
• PIS/PASEP`

const card = {
  background: '#fff', border: '1.5px solid var(--borda)',
  borderRadius: 'var(--raio-lg)', padding: '20px 18px', marginBottom: 14,
  boxShadow: 'var(--sombra)',
}

const stepBadge = (ativo) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, borderRadius: '50%',
  background: ativo ? 'var(--verde)' : 'var(--borda)',
  color: ativo ? '#fff' : 'var(--texto-3)',
  fontSize: '0.7rem', fontWeight: 700, marginRight: 10, flexShrink: 0,
})

const secTitle = {
  fontFamily: 'var(--fonte-titulo)', fontSize: '0.78rem', fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase',
  color: 'var(--texto-2)', margin: 0,
}

// Estado inicial limpo para dependente
const DEP_VAZIO = { cpf: '', nome: '', email: '', parentesco: 'FILHO' }

export function NovoAgendamento() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [tipoPessoa, setTipoPessoa] = useState('SERVIDOR')
  const [dataSel, setDataSel]       = useState('')
  const [slots, setSlots]           = useState([])
  const [slotSel, setSlotSel]       = useState(null)
  const [ciente, setCiente]         = useState(false)
  const [dep, setDep]               = useState(DEP_VAZIO)

  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [sucesso, setSucesso]       = useState(null)
  const [errosCampos, setErrosCampos] = useState({})

  // Limpar seleção de slot ao mudar data
  useEffect(() => {
    if (!dataSel) return
    setSlots([]); setSlotSel(null); setCarregandoSlots(true); setErro('')
    db.from('slots')
      .select('id, hora, capacidade, ocupacao_atual')
      .eq('data', dataSel).eq('ativo', true).order('hora')
      .then(({ data, error }) => {
        setCarregandoSlots(false)
        if (error) { setErro('Erro ao carregar horários.'); return }
        setSlots(data ?? [])
      })
  }, [dataSel])

  function validar() {
    const erros = {}
    if (!dataSel) erros.data  = 'Selecione uma data.'
    if (!slotSel) erros.slot  = 'Selecione um horário.'
    if (!ciente)  erros.ciente = 'Confirme a ciência da documentação.'
    if (tipoPessoa === 'DEPENDENTE') {
      if (!validarCPF(dep.cpf))      erros.depCPF   = 'CPF inválido.'
      if (!dep.nome.trim())          erros.depNome  = 'Informe o nome.'
      if (!dep.email.includes('@'))  erros.depEmail = 'Email inválido.'
    }
    setErrosCampos(erros)
    return Object.keys(erros).length === 0
  }

  async function handleAgendar() {
    setErro('')
    if (!validar()) return
    setSalvando(true)
    try {
      let dependenteId = null
      let cpfAgendado  = normalizarCPF(sessao.cpf ?? '')
      let nomeAgendado = sessao.nome
      let emailDestino = sessao.email

      if (tipoPessoa === 'DEPENDENTE') {
        cpfAgendado  = normalizarCPF(dep.cpf)
        nomeAgendado = dep.nome.trim().toUpperCase()
        emailDestino = dep.email.trim()

        // Buscar dependente existente ou criar novo
        const { data: depExist } = await db.from('dependentes').select('id')
          .eq('servidor_responsavel_id', sessao.servidorId)
          .eq('cpf', cpfAgendado).maybeSingle()

        if (depExist) {
          dependenteId = depExist.id
        } else {
          const { data: depNovo, error: depErro } = await db.from('dependentes')
            .insert({
              servidor_responsavel_id: sessao.servidorId,
              nome: nomeAgendado, cpf: cpfAgendado,
              parentesco: dep.parentesco, email: emailDestino,
            }).select('id').single()
          if (depErro) throw depErro
          dependenteId = depNovo.id
        }
      }

      // Reserva atômica
      const { data: reserva, error: reservaErro } = await db
        .rpc('reservar_vaga', { p_slot_id: slotSel.id })
      if (reservaErro) throw reservaErro
      if (!reserva) {
        setErro('Este horário foi preenchido agora mesmo. Escolha outro.')
        setSalvando(false)
        const d = dataSel; setDataSel(''); setTimeout(() => setDataSel(d), 100)
        return
      }

      const qrCode = gerarQRCodeId()
      const { data: ag, error: agErro } = await db.from('agendamentos').insert({
        servidor_responsavel_id:  sessao.servidorId,
        dependente_id:            dependenteId,
        cpf_servidor_responsavel: normalizarCPF(sessao.cpf ?? ''),
        cpf_agendado:             cpfAgendado,
        nome_agendado:            nomeAgendado,
        tipo_pessoa:              tipoPessoa,
        slot_id:                  slotSel.id,
        status:                   'AGENDADO',
        qr_code:                  qrCode,
        email_destino:            emailDestino,
        ciente_documentacao:      true,
      }).select('id').single()

      if (agErro) {
        // Reverter reserva se agendamento falhou
        await db.rpc('liberar_vaga', { p_slot_id: slotSel.id })
        throw agErro
      }

      await registrarAuditoria(sessao.token, {
        operacao: 'CRIAR_AGENDAMENTO', objeto: 'AGENDAMENTO', objetoId: ag.id,
        depois: { cpfAgendado, nomeAgendado, tipoPessoa },
      })

      setSucesso({ nomeAgendado, data: dataSel, hora: slotSel.hora, qrCode, tipoPessoa })

    } catch (e) {
      // Traduzir erro de unicidade de forma amigável
      const msg = e?.message ?? ''
      if (msg.includes('servidor_proprio_ativo')) {
        setErro('Você já possui um agendamento ativo para si mesmo. Cancele-o antes de criar outro.')
      } else if (msg.includes('cpf_ativo')) {
        setErro('Este CPF já possui um agendamento ativo no sistema.')
      } else {
        setErro(traduzirErro(e))
      }
    } finally {
      setSalvando(false)
    }
  }

  // Após sucesso: se for dependente, limpar campos e permitir novo agendamento
  // Se for titular, volta para o dashboard
  function handlePosAgendamento(novoAgendamento) {
    if (sucesso?.tipoPessoa === 'DEPENDENTE' && novoAgendamento) {
      // ── LIMPAR TUDO para próximo dependente ──
      setDep(DEP_VAZIO)
      setDataSel('')
      setSlotSel(null)
      setCiente(false)
      setErrosCampos({})
      setSucesso(null)
    } else {
      setPagina('dashboard')
    }
  }

  if (sucesso) {
    return (
      <TelaSucesso
        sucesso={sucesso}
        onVoltar={() => setPagina('dashboard')}
        onNovoDependent={() => handlePosAgendamento(true)}
      />
    )
  }

  const slotsDisponiveis = slots.filter(s => s.ocupacao_atual < s.capacidade)
  const slotsCheios      = slots.filter(s => s.ocupacao_atual >= s.capacidade)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>

      {/* Header */}
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={() => setPagina('dashboard')} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Novo Agendamento
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
          Emissão da Carteira de Identidade Nacional — CIN
        </p>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>

        {erro && <div style={{ marginBottom: 14 }}><Alerta tipo="erro">{erro}</Alerta></div>}

        {/* PASSO 1 — Tipo */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={stepBadge(true)}>1</span>
            <p style={secTitle}>Para quem é o agendamento?</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { valor: 'SERVIDOR',   label: 'Para mim' },
              { valor: 'DEPENDENTE', label: 'Para um dependente' },
            ].map(op => (
              <button key={op.valor}
                onClick={() => { setTipoPessoa(op.valor); setErrosCampos({}); setErro('') }}
                style={{
                  padding: '14px 10px', borderRadius: 10,
                  border: `2px solid ${tipoPessoa === op.valor ? 'var(--verde)' : 'var(--borda)'}`,
                  background: tipoPessoa === op.valor ? 'var(--verde-claro)' : '#fff',
                  color: tipoPessoa === op.valor ? 'var(--verde)' : 'var(--texto-2)',
                  fontFamily: 'var(--fonte-corpo)', fontSize: '0.88rem',
                  fontWeight: tipoPessoa === op.valor ? 700 : 400,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* PASSO 2 — Dados dependente */}
        {tipoPessoa === 'DEPENDENTE' && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={stepBadge(true)}>2</span>
              <p style={secTitle}>Dados do dependente</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Campo label="CPF do dependente" type="text" value={dep.cpf}
                onChange={e => setDep(d => ({ ...d, cpf: e.target.value }))}
                placeholder="Somente números" maxLength={14} erro={errosCampos.depCPF} />
              <Campo label="Nome completo" type="text" value={dep.nome}
                onChange={e => setDep(d => ({ ...d, nome: e.target.value }))}
                placeholder="Nome completo" erro={errosCampos.depNome} />
              <Campo label="Email" type="email" value={dep.email}
                onChange={e => setDep(d => ({ ...d, email: e.target.value }))}
                placeholder="email@exemplo.com" erro={errosCampos.depEmail} />
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--texto-2)',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  fontWeight: 600, display: 'block', marginBottom: 8 }}>
                  Parentesco
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {PARENTESCOS.map(p => (
                    <button key={p.valor}
                      onClick={() => setDep(d => ({ ...d, parentesco: p.valor }))}
                      style={{
                        flex: 1, padding: '12px 8px', borderRadius: 10,
                        border: `2px solid ${dep.parentesco === p.valor ? 'var(--verde)' : 'var(--borda)'}`,
                        background: dep.parentesco === p.valor ? 'var(--verde-claro)' : '#fff',
                        color: dep.parentesco === p.valor ? 'var(--verde)' : 'var(--texto-2)',
                        fontFamily: 'var(--fonte-corpo)', fontSize: '0.88rem',
                        fontWeight: dep.parentesco === p.valor ? 700 : 400,
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PASSO — Data */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={stepBadge(!!dataSel)}>{tipoPessoa === 'DEPENDENTE' ? 3 : 2}</span>
            <p style={secTitle}>Escolha a data</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DATAS.map(d => (
              <button key={d.valor}
                onClick={() => { setDataSel(d.valor); setSlotSel(null) }}
                style={{
                  padding: '14px 16px', borderRadius: 10,
                  border: `2px solid ${dataSel === d.valor ? 'var(--verde)' : 'var(--borda)'}`,
                  background: dataSel === d.valor ? 'var(--verde-claro)' : '#fff',
                  color: dataSel === d.valor ? 'var(--verde)' : 'var(--texto-2)',
                  fontFamily: 'var(--fonte-corpo)', fontSize: '0.9rem',
                  fontWeight: dataSel === d.valor ? 700 : 400,
                  textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                }}>
                {d.label}
              </button>
            ))}
          </div>
          {errosCampos.data && (
            <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>
              {errosCampos.data}
            </p>
          )}
        </div>

        {/* PASSO — Horário */}
        {dataSel && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={stepBadge(!!slotSel)}>{tipoPessoa === 'DEPENDENTE' ? 4 : 3}</span>
              <p style={secTitle}>Escolha o horário</p>
            </div>

            {carregandoSlots && (
              <p style={{ color: 'var(--texto-3)', textAlign: 'center', padding: 16 }}>
                Carregando horários...
              </p>
            )}

            {!carregandoSlots && slotsDisponiveis.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8,
                marginBottom: slotsCheios.length ? 14 : 0 }}>
                {slotsDisponiveis.map(s => {
                  const sel   = slotSel?.id === s.id
                  const vagas = s.capacidade - s.ocupacao_atual
                  return (
                    <button key={s.id} onClick={() => setSlotSel(s)} style={{
                      padding: '12px 4px', borderRadius: 10,
                      border: `2px solid ${sel ? 'var(--verde)' : 'var(--borda)'}`,
                      background: sel ? 'var(--verde-claro)' : '#fff',
                      cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}>
                      <span style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.95rem',
                        fontWeight: 700, color: sel ? 'var(--verde)' : 'var(--texto)' }}>
                        {s.hora.slice(0, 5)}
                      </span>
                      <span style={{ fontSize: '0.62rem',
                        color: sel ? 'var(--verde)' : 'var(--texto-3)' }}>
                        {vagas} vaga{vagas !== 1 ? 's' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {!carregandoSlots && slotsCheios.length > 0 && (
              <>
                <p style={{ fontSize: '0.7rem', color: 'var(--texto-3)',
                  letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Esgotados
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {slotsCheios.map(s => (
                    <div key={s.id} style={{ padding: '12px 4px', borderRadius: 10,
                      border: '1px solid var(--borda)', background: 'var(--surface-2)',
                      textAlign: 'center', opacity: 0.5 }}>
                      <span style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.95rem',
                        fontWeight: 700, color: 'var(--texto-3)', display: 'block' }}>
                        {s.hora.slice(0, 5)}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'var(--texto-3)' }}>Esgotado</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!carregandoSlots && slots.length === 0 && (
              <Alerta tipo="info">Nenhum horário disponível para esta data.</Alerta>
            )}

            {errosCampos.slot && (
              <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>
                {errosCampos.slot}
              </p>
            )}
          </div>
        )}

        {/* PASSO — Documentação + Aceite */}
        {slotSel && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
              <span style={stepBadge(ciente)}>{tipoPessoa === 'DEPENDENTE' ? 5 : 4}</span>
              <p style={secTitle}>Documentação necessária</p>
            </div>

            <div style={{ background: 'var(--verde-claro)', border: '1px solid var(--verde)',
              borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
              {DOCS_TEXTO.split('\n').map((linha, i) => (
                <p key={i} style={{
                  color: linha.startsWith('•') ? 'var(--texto)' : 'var(--texto-2)',
                  fontSize: '0.82rem', lineHeight: 1.7, marginBottom: 1,
                }}>
                  {linha || '\u00a0'}
                </p>
              ))}
            </div>

            <button onClick={() => setCiente(v => !v)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textAlign: 'left', width: '100%',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
                border: `2px solid ${ciente ? 'var(--verde)' : 'var(--borda)'}`,
                background: ciente ? 'var(--verde)' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                {ciente && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>✓</span>}
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--texto-2)', lineHeight: 1.5 }}>
                Estou ciente da documentação exigida e me comprometo a comparecer com os documentos no dia e horário agendados.
              </p>
            </button>
            {errosCampos.ciente && (
              <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>
                {errosCampos.ciente}
              </p>
            )}
          </div>
        )}

        {/* Resumo + Botão */}
        {slotSel && ciente && (
          <div>
            <div style={{ background: 'var(--verde-claro)', border: '1px solid var(--verde)',
              borderRadius: 10, padding: '14px 16px', marginBottom: 14,
              fontSize: '0.85rem', color: 'var(--texto-2)', lineHeight: 1.9 }}>
              <strong style={{ color: 'var(--texto)', display: 'block', marginBottom: 4 }}>
                Resumo
              </strong>
              Agendado para: <strong style={{ color: 'var(--texto)' }}>
                {tipoPessoa === 'DEPENDENTE' ? (dep.nome || '—') : sessao.nome}
              </strong><br/>
              Data: <strong style={{ color: 'var(--texto)' }}>
                {DATAS.find(d => d.valor === dataSel)?.label}
              </strong><br/>
              Horário: <strong style={{ color: 'var(--texto)' }}>{slotSel.hora.slice(0, 5)}</strong>
            </div>
            <Botao variante="verde" onClick={handleAgendar} carregando={salvando}>
              Confirmar Agendamento
            </Botao>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tela de sucesso ──────────────────────────────────────────
function TelaSucesso({ sucesso, onVoltar, onNovoDependent }) {
  const dataLabel = sucesso.data === '2026-06-15' ? '15/06/2026' : '16/06/2026'
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(sucesso.qrCode)}&bgcolor=ffffff&color=006830&margin=14`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>

        <div style={{ width: 60, height: 60, borderRadius: '50%',
          background: 'var(--verde-claro)', border: '2px solid var(--verde)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: '1.5rem', color: 'var(--verde)' }}>
          ✓
        </div>

        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: 'var(--texto)', marginBottom: 6 }}>
          Agendamento confirmado!
        </h2>
        <p style={{ color: 'var(--texto-2)', fontSize: '0.88rem',
          marginBottom: 24, lineHeight: 1.7 }}>
          {sucesso.nomeAgendado}<br/>
          {dataLabel} às {sucesso.hora.slice(0, 5)}
        </p>

        {/* QRCode */}
        <div style={{ background: '#fff', border: '1.5px solid var(--borda)',
          borderRadius: 16, padding: 24, marginBottom: 20,
          display: 'inline-block', boxShadow: 'var(--sombra)' }}>
          <img src={qrUrl} alt="QRCode"
            style={{ width: 180, height: 180, display: 'block', borderRadius: 8 }} />
          <p style={{ fontSize: '0.6rem', color: 'var(--texto-3)',
            marginTop: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {sucesso.qrCode}
          </p>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'var(--texto-3)',
          marginBottom: 24, lineHeight: 1.6 }}>
          📱 Tire um print desta tela.<br/>
          Apresente o QRCode no dia do atendimento.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sucesso.tipoPessoa === 'DEPENDENTE' && (
            <Botao variante="verde" onClick={onNovoDependent}>
              Agendar outro dependente
            </Botao>
          )}
          <Botao variante="secundario" onClick={onVoltar}>Voltar ao início</Botao>
        </div>
      </div>
    </div>
  )
}
