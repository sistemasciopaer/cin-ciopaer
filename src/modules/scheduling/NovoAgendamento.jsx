import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { normalizarCPF, formatarCPF, validarCPF } from '@/lib/cpf'
import { gerarQRCodeId } from '@/lib/token'
import { traduzirErro } from '@/lib/erros'
import { registrarAuditoria } from '@/modules/audit/auditRepository'
import { enfileirarEmail } from '@/modules/queue/queueRepository'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Alerta } from '@/components/ui/Alerta'

const DATAS = [
  { valor: '2026-06-15', label: '15 de junho de 2026 (segunda-feira)' },
  { valor: '2026-06-16', label: '16 de junho de 2026 (terça-feira)' },
]

const PARENTESCOS = ['FILHO', 'CONJUGE', 'GENITOR']

// ── Estilos inline reutilizáveis ─────────────────────────────
const card = {
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  padding: '24px 20px',
  marginBottom: 16,
}

const secTitle = {
  fontFamily: 'var(--fonte-titulo)',
  fontSize: '0.78rem',
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: 14,
}

const stepBadge = (ativo) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: ativo ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)',
  color: ativo ? '#fff' : 'rgba(255,255,255,0.3)',
  fontSize: '0.7rem',
  fontWeight: 700,
  marginRight: 10,
  flexShrink: 0,
})

export function NovoAgendamento() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  // ── Estado do formulário ─────────────────────────────────
  const [tipoPessoa, setTipoPessoa]       = useState('SERVIDOR')
  const [dataSel, setDataSel]             = useState('')
  const [slots, setSlots]                 = useState([])
  const [slotSel, setSlotSel]             = useState(null)
  const [ciente, setCiente]               = useState(false)

  // Dependente
  const [depCPF, setDepCPF]               = useState('')
  const [depNome, setDepNome]             = useState('')
  const [depEmail, setDepEmail]           = useState('')
  const [depParentesco, setDepParentesco] = useState('FILHO')

  // UI
  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [salvando, setSalvando]               = useState(false)
  const [erro, setErro]                       = useState('')
  const [sucesso, setSucesso]                 = useState(null) // { nomeAgendado, data, hora }
  const [errosCampos, setErrosCampos]         = useState({})

  // ── Carregar slots ao escolher data ─────────────────────
  useEffect(() => {
    if (!dataSel) return
    setSlots([])
    setSlotSel(null)
    setCarregandoSlots(true)
    setErro('')

    db.from('slots')
      .select('id, hora, capacidade, ocupacao_atual')
      .eq('data', dataSel)
      .eq('ativo', true)
      .order('hora')
      .then(({ data, error }) => {
        setCarregandoSlots(false)
        if (error) { setErro('Erro ao carregar horários.'); return }
        setSlots(data ?? [])
      })
  }, [dataSel])

  // ── Validação ────────────────────────────────────────────
  function validar() {
    const erros = {}
    if (!dataSel)  erros.data  = 'Selecione uma data.'
    if (!slotSel)  erros.slot  = 'Selecione um horário.'
    if (!ciente)   erros.ciente = 'Confirme a ciência da documentação.'

    if (tipoPessoa === 'DEPENDENTE') {
      if (!validarCPF(depCPF))          erros.depCPF  = 'CPF inválido.'
      if (!depNome.trim())              erros.depNome  = 'Informe o nome do dependente.'
      if (!depEmail.includes('@'))      erros.depEmail = 'Email inválido.'
    }

    setErrosCampos(erros)
    return Object.keys(erros).length === 0
  }

  // ── Submeter agendamento ─────────────────────────────────
  async function handleAgendar() {
    setErro('')
    if (!validar()) return

    setSalvando(true)
    try {
      let dependenteId = null
      let cpfAgendado  = normalizarCPF(sessao.cpf ?? '')
      let nomeAgendado = sessao.nome
      let emailDestino = sessao.email

      // ── Dependente: salvar/buscar ────────────────────────
      if (tipoPessoa === 'DEPENDENTE') {
        cpfAgendado  = normalizarCPF(depCPF)
        nomeAgendado = depNome.trim().toUpperCase()
        emailDestino = depEmail.trim()

        // Verificar se dependente já existe para este servidor
        const { data: depExist } = await db
          .from('dependentes')
          .select('id')
          .eq('servidor_responsavel_id', sessao.servidorId)
          .eq('cpf', cpfAgendado)
          .maybeSingle()

        if (depExist) {
          dependenteId = depExist.id
        } else {
          const { data: depNovo, error: depErro } = await db
            .from('dependentes')
            .insert({
              servidor_responsavel_id: sessao.servidorId,
              nome:        nomeAgendado,
              cpf:         cpfAgendado,
              parentesco:  depParentesco,
              email:       emailDestino,
            })
            .select('id')
            .single()

          if (depErro) throw depErro
          dependenteId = depNovo.id
        }
      }

      // ── Reservar vaga atomicamente ───────────────────────
      const { data: reserva, error: reservaErro } = await db
        .rpc('reservar_vaga', { p_slot_id: slotSel.id })

      if (reservaErro) throw reservaErro
      if (!reserva) {
        setErro('Este horário foi preenchido agora mesmo. Escolha outro.')
        setSalvando(false)
        // Recarregar slots para mostrar disponibilidade atual
        setDataSel(s => { const v = s; setDataSel(''); setTimeout(() => setDataSel(v), 50); return '' })
        return
      }

      // ── Criar agendamento ────────────────────────────────
      const qrCode = gerarQRCodeId()
      const { data: ag, error: agErro } = await db
        .from('agendamentos')
        .insert({
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
        })
        .select('id')
        .single()

      if (agErro) {
        // Slot reservado mas agendamento falhou — liberar vaga
        await db.rpc('liberar_vaga', { p_slot_id: slotSel.id })
        throw agErro
      }

      // ── Auditoria e email (não bloqueantes) ──────────────
      await registrarAuditoria(sessao.token, {
        operacao:  'CRIAR_AGENDAMENTO',
        objeto:    'AGENDAMENTO',
        objetoId:  ag.id,
        depois:    { cpfAgendado, nomeAgendado, slotId: slotSel.id, tipoPessoa },
      })

      await enfileirarEmail(sessao.token, {
        agendamentoId: ag.id,
        tipoEvento:    'CONFIRMACAO',
        destinatario:  emailDestino,
        assunto:       'AGENDAMENTO PARA EMISSÃO DA CIN',
        corpoHtml:     montarEmailHTML({ nomeAgendado, data: dataSel, hora: slotSel.hora, qrCode }),
        prioridade:    1,
      })

      setSucesso({ nomeAgendado, data: dataSel, hora: slotSel.hora, qrCode, agendamentoId: ag.id })

    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setSalvando(false)
    }
  }

  // ── Tela de sucesso ──────────────────────────────────────
  if (sucesso) {
    return <TelaSucesso sucesso={sucesso} onVoltar={() => setPagina('dashboard')} onNovo={() => setSucesso(null)} />
  }

  // ── Render principal ─────────────────────────────────────
  const slotsDisponiveis = slots.filter(s => s.ocupacao_atual < s.capacidade)
  const slotsCheios      = slots.filter(s => s.ocupacao_atual >= s.capacidade)

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 520, margin: '0 auto' }}>

      {/* Header */}
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 6, padding: 0,
      }}>
        ← Voltar
      </button>

      <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.4rem',
        fontWeight: 700, color: '#fff', marginBottom: 6 }}>
        Novo Agendamento
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', marginBottom: 28 }}>
        Emissão da Carteira de Identidade Nacional — CIN
      </p>

      {erro && <div style={{ marginBottom: 16 }}><Alerta tipo="erro">{erro}</Alerta></div>}

      {/* PASSO 1 — Tipo de pessoa */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <span style={stepBadge(true)}>1</span>
          <p style={{ ...secTitle, margin: 0 }}>Para quem é o agendamento?</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { valor: 'SERVIDOR',   label: 'Para mim' },
            { valor: 'DEPENDENTE', label: 'Para um dependente' },
          ].map(op => (
            <button key={op.valor} onClick={() => { setTipoPessoa(op.valor); setErrosCampos({}) }}
              style={{
                padding: '14px 10px',
                borderRadius: 10,
                border: `2px solid ${tipoPessoa === op.valor ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)'}`,
                background: tipoPessoa === op.valor ? 'rgba(0,128,61,0.15)' : 'transparent',
                color: tipoPessoa === op.valor ? '#fff' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--fonte-corpo)',
                fontSize: '0.88rem',
                fontWeight: tipoPessoa === op.valor ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* PASSO 2 — Dados do dependente */}
      {tipoPessoa === 'DEPENDENTE' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={stepBadge(true)}>2</span>
            <p style={{ ...secTitle, margin: 0 }}>Dados do dependente</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Campo label="CPF do dependente" type="text" value={depCPF}
              onChange={e => setDepCPF(e.target.value)}
              placeholder="Somente números" maxLength={14}
              erro={errosCampos.depCPF} />

            <Campo label="Nome completo" type="text" value={depNome}
              onChange={e => setDepNome(e.target.value)}
              placeholder="Nome completo do dependente"
              erro={errosCampos.depNome} />

            <Campo label="Email" type="email" value={depEmail}
              onChange={e => setDepEmail(e.target.value)}
              placeholder="email@exemplo.com"
              erro={errosCampos.depEmail} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Parentesco
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PARENTESCOS.map(p => (
                  <button key={p} onClick={() => setDepParentesco(p)} style={{
                    flex: 1, padding: '10px 6px',
                    borderRadius: 8,
                    border: `1.5px solid ${depParentesco === p ? 'var(--verde-base)' : 'rgba(255,255,255,0.12)'}`,
                    background: depParentesco === p ? 'rgba(0,128,61,0.15)' : 'transparent',
                    color: depParentesco === p ? '#fff' : 'rgba(255,255,255,0.45)',
                    fontFamily: 'var(--fonte-corpo)',
                    fontSize: '0.78rem',
                    fontWeight: depParentesco === p ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                    {p === 'CONJUGE' ? 'Cônjuge' : p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PASSO 3 — Data */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <span style={stepBadge(!!dataSel)}>{tipoPessoa === 'DEPENDENTE' ? 3 : 2}</span>
          <p style={{ ...secTitle, margin: 0 }}>Escolha a data</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DATAS.map(d => (
            <button key={d.valor} onClick={() => { setDataSel(d.valor); setSlotSel(null) }}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                border: `2px solid ${dataSel === d.valor ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)'}`,
                background: dataSel === d.valor ? 'rgba(0,128,61,0.15)' : 'transparent',
                color: dataSel === d.valor ? '#fff' : 'rgba(255,255,255,0.55)',
                fontFamily: 'var(--fonte-corpo)',
                fontSize: '0.9rem',
                fontWeight: dataSel === d.valor ? 600 : 400,
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {d.label}
            </button>
          ))}
        </div>
        {errosCampos.data && <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>{errosCampos.data}</p>}
      </div>

      {/* PASSO 4 — Horário */}
      {dataSel && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={stepBadge(!!slotSel)}>{tipoPessoa === 'DEPENDENTE' ? 4 : 3}</span>
            <p style={{ ...secTitle, margin: 0 }}>Escolha o horário</p>
          </div>

          {carregandoSlots && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>
              Carregando horários...
            </p>
          )}

          {!carregandoSlots && slots.length === 0 && (
            <Alerta tipo="info">Nenhum horário disponível para esta data.</Alerta>
          )}

          {!carregandoSlots && slots.length > 0 && (
            <>
              {/* Slots disponíveis */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: slotsCheios.length ? 16 : 0 }}>
                {slotsDisponiveis.map(s => {
                  const selecionado = slotSel?.id === s.id
                  const vagas = s.capacidade - s.ocupacao_atual
                  return (
                    <button key={s.id} onClick={() => setSlotSel(s)} style={{
                      padding: '12px 4px',
                      borderRadius: 10,
                      border: `2px solid ${selecionado ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)'}`,
                      background: selecionado ? 'rgba(0,128,61,0.2)' : 'rgba(255,255,255,0.03)',
                      color: selecionado ? '#fff' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                    }}>
                      <span style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.95rem', fontWeight: 700 }}>
                        {s.hora.slice(0, 5)}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: selecionado ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                        {vagas} vaga{vagas !== 1 ? 's' : ''}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Slots cheios */}
              {slotsCheios.length > 0 && (
                <>
                  <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)',
                    letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    Horários esgotados
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {slotsCheios.map(s => (
                      <div key={s.id} style={{
                        padding: '12px 4px',
                        borderRadius: 10,
                        border: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(255,255,255,0.02)',
                        textAlign: 'center',
                        opacity: 0.35,
                      }}>
                        <span style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.95rem', fontWeight: 700,
                          color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                          {s.hora.slice(0, 5)}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.25)' }}>Esgotado</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {errosCampos.slot && <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>{errosCampos.slot}</p>}
        </div>
      )}

      {/* PASSO 5 — Aceite */}
      {slotSel && (
        <div style={{ ...card, border: ciente ? '1px solid rgba(0,128,61,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setCiente(v => !v)} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14,
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, textAlign: 'left', width: '100%',
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
              border: `2px solid ${ciente ? 'var(--verde-base)' : 'rgba(255,255,255,0.25)'}`,
              background: ciente ? 'var(--verde-base)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}>
              {ciente && <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>✓</span>}
            </div>
            <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
              Estou ciente de que devo comparecer com a documentação necessária para emissão da CIN no dia e horário agendados.
            </p>
          </button>
          {errosCampos.ciente && <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>{errosCampos.ciente}</p>}
        </div>
      )}

      {/* Resumo + Botão */}
      {slotSel && (
        <div style={{ marginTop: 8 }}>
          {/* Resumo */}
          <div style={{
            background: 'rgba(0,128,61,0.08)',
            border: '1px solid rgba(0,128,61,0.2)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 16,
            fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8,
          }}>
            <strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>Resumo do agendamento</strong>
            <span>Agendado para: </span>
            <strong style={{ color: '#fff' }}>
              {tipoPessoa === 'DEPENDENTE' ? (depNome || '—') : sessao.nome}
            </strong><br/>
            <span>Data: </span>
            <strong style={{ color: '#fff' }}>
              {DATAS.find(d => d.valor === dataSel)?.label}
            </strong><br/>
            <span>Horário: </span>
            <strong style={{ color: '#fff' }}>{slotSel.hora.slice(0, 5)}</strong>
          </div>

          <Botao onClick={handleAgendar} carregando={salvando} desabilitado={!ciente}>
            Confirmar Agendamento
          </Botao>
        </div>
      )}
    </div>
  )
}

// ── Tela de sucesso com QRCode ───────────────────────────────
function TelaSucesso({ sucesso, onVoltar, onNovo }) {
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    // Gerar QRCode como imagem via API pública
    const texto = encodeURIComponent(sucesso.qrCode)
    setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${texto}&bgcolor=0a1628&color=ffffff&margin=10`)
  }, [sucesso.qrCode])

  const dataLabel = sucesso.data === '2026-06-15' ? '15/06/2026' : '16/06/2026'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center' }}>

        {/* Ícone de sucesso */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(0,128,61,0.2)',
          border: '2px solid var(--verde-base)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: '1.6rem',
        }}>✓</div>

        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff', marginBottom: 8 }}>
          Agendamento confirmado!
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', marginBottom: 28, lineHeight: 1.6 }}>
          {sucesso.nomeAgendado}<br/>
          {dataLabel} às {sucesso.hora.slice(0, 5)}
        </p>

        {/* QRCode */}
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 24, marginBottom: 24,
          display: 'inline-block',
        }}>
          {qrUrl
            ? <img src={qrUrl} alt="QRCode do agendamento" style={{ width: 180, height: 180, display: 'block' }} />
            : <div style={{ width: 180, height: 180, background: 'rgba(255,255,255,0.05)',
                borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.8rem' }}>Gerando QR...</span>
              </div>
          }
          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)',
            marginTop: 10, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            {sucesso.qrCode}
          </p>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)',
          marginBottom: 28, lineHeight: 1.6 }}>
          Apresente este QRCode no dia do atendimento.<br/>
          Uma confirmação foi enviada por email.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Botao onClick={onNovo} variante="secundario">Fazer outro agendamento</Botao>
          <Botao onClick={onVoltar}>Voltar ao início</Botao>
        </div>
      </div>
    </div>
  )
}

// ── Template de email ────────────────────────────────────────
function montarEmailHTML({ nomeAgendado, data, hora, qrCode }) {
  const dataFmt = data === '2026-06-15' ? '15/06/2026' : '16/06/2026'
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0a1628;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <div style="background:#00803D;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:1.4rem;letter-spacing:0.08em;">CIOPAER</h1>
      <p style="color:rgba(255,255,255,0.8);margin:6px 0 0;font-size:0.85rem;">
        Agendamento para Emissão da CIN
      </p>
    </div>
    <div style="background:#111f38;border-radius:0 0 12px 12px;padding:28px 24px;">
      <p style="color:#f0ece3;font-size:0.95rem;margin:0 0 20px;">
        Olá, <strong>${nomeAgendado}</strong>.<br/>
        Seu agendamento foi confirmado com sucesso.
      </p>
      <div style="background:rgba(0,128,61,0.1);border:1px solid rgba(0,128,61,0.3);
        border-radius:10px;padding:16px 20px;margin-bottom:24px;">
        <p style="color:#f0ece3;margin:0;line-height:2;">
          📅 <strong>Data:</strong> ${dataFmt}<br/>
          🕐 <strong>Horário:</strong> ${hora.slice(0,5)}<br/>
          👤 <strong>Nome:</strong> ${nomeAgendado}
        </p>
      </div>
      <p style="color:rgba(240,236,227,0.6);font-size:0.82rem;line-height:1.6;margin:0 0 20px;">
        Apresente o QRCode abaixo no dia do atendimento. 
        Lembre-se de trazer a documentação necessária.
      </p>
      <div style="text-align:center;margin-bottom:24px;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrCode)}&margin=10"
          alt="QRCode" style="border-radius:8px;"/>
        <p style="color:rgba(240,236,227,0.3);font-size:0.7rem;margin:8px 0 0;font-family:monospace;">
          ${qrCode}
        </p>
      </div>
      <p style="color:rgba(240,236,227,0.4);font-size:0.78rem;text-align:center;margin:0;">
        Sistema de Agendamentos CIOPAER
      </p>
    </div>
  </div>
</body>
</html>`
}
