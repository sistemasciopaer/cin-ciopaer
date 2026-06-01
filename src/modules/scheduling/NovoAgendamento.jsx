import { useState, useEffect, useRef } from 'react'
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

const PARENTESCOS = ['FILHO', 'CONJUGE', 'GENITOR']

const DOCS_TEXTO = `Conforme o Decreto nº 10.977/2022, é obrigatória a apresentação da certidão original, em meio físico ou digital, emitida pelo cartório competente:

• Solteiros: Certidão de Nascimento
• Casados: Certidão de Casamento
• Divorciados: Certidão de Casamento com averbação do divórcio
• Viúvos: Certidão de Casamento com averbação do óbito do cônjuge

Opcionalmente, poderão ser incluídas na CIN, mediante apresentação da documentação comprobatória:
• Título de Eleitor
• Tipo Sanguíneo
• Carteira Nacional de Habilitação (CNH)
• PIS/PASEP`

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
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 24, height: 24, borderRadius: '50%',
  background: ativo ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)',
  color: ativo ? '#fff' : 'rgba(255,255,255,0.3)',
  fontSize: '0.7rem', fontWeight: 700, marginRight: 10, flexShrink: 0,
})

export function NovoAgendamento() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [tipoPessoa, setTipoPessoa]   = useState('SERVIDOR')
  const [dataSel, setDataSel]         = useState('')
  const [slots, setSlots]             = useState([])
  const [slotSel, setSlotSel]         = useState(null)
  const [ciente, setCiente]           = useState(false)

  const [depCPF, setDepCPF]           = useState('')
  const [depNome, setDepNome]         = useState('')
  const [depEmail, setDepEmail]       = useState('')
  const [depParentesco, setDepParentesco] = useState('FILHO')

  const [carregandoSlots, setCarregandoSlots] = useState(false)
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')
  const [sucesso, setSucesso]         = useState(null)
  const [errosCampos, setErrosCampos] = useState({})

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
      if (!validarCPF(depCPF))      erros.depCPF   = 'CPF inválido.'
      if (!depNome.trim())          erros.depNome  = 'Informe o nome.'
      if (!depEmail.includes('@'))  erros.depEmail = 'Email inválido.'
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
        cpfAgendado  = normalizarCPF(depCPF)
        nomeAgendado = depNome.trim().toUpperCase()
        emailDestino = depEmail.trim()

        const { data: depExist } = await db.from('dependentes').select('id')
          .eq('servidor_responsavel_id', sessao.servidorId)
          .eq('cpf', cpfAgendado).maybeSingle()

        if (depExist) {
          dependenteId = depExist.id
        } else {
          const { data: depNovo, error: depErro } = await db.from('dependentes')
            .insert({ servidor_responsavel_id: sessao.servidorId,
              nome: nomeAgendado, cpf: cpfAgendado,
              parentesco: depParentesco, email: emailDestino })
            .select('id').single()
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
        // Recarregar slots
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
        await db.rpc('liberar_vaga', { p_slot_id: slotSel.id })
        throw agErro
      }

      await registrarAuditoria(sessao.token, {
        operacao: 'CRIAR_AGENDAMENTO', objeto: 'AGENDAMENTO', objetoId: ag.id,
        depois: { cpfAgendado, nomeAgendado, slotId: slotSel.id, tipoPessoa },
      })

      setSucesso({ nomeAgendado, data: dataSel, hora: slotSel.hora, qrCode })

    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setSalvando(false)
    }
  }

  if (sucesso) {
    return <TelaSucesso sucesso={sucesso}
      onVoltar={() => setPagina('dashboard')}
      onNovo={() => { setSucesso(null); setDataSel(''); setSlotSel(null); setCiente(false) }} />
  }

  const slotsDisponiveis = slots.filter(s => s.ocupacao_atual < s.capacidade)
  const slotsCheios      = slots.filter(s => s.ocupacao_atual >= s.capacidade)
  const passo = (n) => tipoPessoa === 'DEPENDENTE' ? n : n - 1

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24, padding: 0 }}>
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

      {/* PASSO 1 — Tipo */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <span style={stepBadge(true)}>1</span>
          <p style={{ ...secTitle, margin: 0 }}>Para quem é o agendamento?</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { valor: 'SERVIDOR',   label: 'Para mim' },       // ← CORRIGIDO
            { valor: 'DEPENDENTE', label: 'Para um dependente' },
          ].map(op => (
            <button key={op.valor} onClick={() => { setTipoPessoa(op.valor); setErrosCampos({}) }}
              style={{
                padding: '14px 10px', borderRadius: 10,
                border: `2px solid ${tipoPessoa === op.valor ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)'}`,
                background: tipoPessoa === op.valor ? 'rgba(0,128,61,0.15)' : 'transparent',
                color: tipoPessoa === op.valor ? '#fff' : 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--fonte-corpo)', fontSize: '0.88rem',
                fontWeight: tipoPessoa === op.valor ? 600 : 400,
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
            <p style={{ ...secTitle, margin: 0 }}>Dados do dependente</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Campo label="CPF do dependente" type="text" value={depCPF}
              onChange={e => setDepCPF(e.target.value)}
              placeholder="Somente números" maxLength={14} erro={errosCampos.depCPF} />
            <Campo label="Nome completo" type="text" value={depNome}
              onChange={e => setDepNome(e.target.value)}
              placeholder="Nome completo" erro={errosCampos.depNome} />
            <Campo label="Email" type="email" value={depEmail}
              onChange={e => setDepEmail(e.target.value)}
              placeholder="email@exemplo.com" erro={errosCampos.depEmail} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Parentesco
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PARENTESCOS.map(p => (
                  <button key={p} onClick={() => setDepParentesco(p)} style={{
                    flex: 1, padding: '10px 6px', borderRadius: 8,
                    border: `1.5px solid ${depParentesco === p ? 'var(--verde-base)' : 'rgba(255,255,255,0.12)'}`,
                    background: depParentesco === p ? 'rgba(0,128,61,0.15)' : 'transparent',
                    color: depParentesco === p ? '#fff' : 'rgba(255,255,255,0.45)',
                    fontFamily: 'var(--fonte-corpo)', fontSize: '0.78rem',
                    fontWeight: depParentesco === p ? 600 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                    {p === 'CONJUGE' ? 'Cônjuge' : p.charAt(0) + p.slice(1).toLowerCase()}
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
          <p style={{ ...secTitle, margin: 0 }}>Escolha a data</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DATAS.map(d => (
            <button key={d.valor} onClick={() => { setDataSel(d.valor); setSlotSel(null) }}
              style={{
                padding: '14px 16px', borderRadius: 10,
                border: `2px solid ${dataSel === d.valor ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)'}`,
                background: dataSel === d.valor ? 'rgba(0,128,61,0.15)' : 'transparent',
                color: dataSel === d.valor ? '#fff' : 'rgba(255,255,255,0.55)',
                fontFamily: 'var(--fonte-corpo)', fontSize: '0.9rem',
                fontWeight: dataSel === d.valor ? 600 : 400,
                textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
              }}>
              {d.label}
            </button>
          ))}
        </div>
        {errosCampos.data && <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>{errosCampos.data}</p>}
      </div>

      {/* PASSO — Horário */}
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

          {!carregandoSlots && slotsDisponiveis.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: slotsCheios.length ? 16 : 0 }}>
              {slotsDisponiveis.map(s => {
                const sel   = slotSel?.id === s.id
                const vagas = s.capacidade - s.ocupacao_atual
                return (
                  <button key={s.id} onClick={() => setSlotSel(s)} style={{
                    padding: '12px 4px', borderRadius: 10,
                    border: `2px solid ${sel ? 'var(--verde-base)' : 'rgba(255,255,255,0.1)'}`,
                    background: sel ? 'rgba(0,128,61,0.2)' : 'rgba(255,255,255,0.03)',
                    color: sel ? '#fff' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.95rem', fontWeight: 700 }}>
                      {s.hora.slice(0, 5)}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: sel ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.35)' }}>
                      {vagas} vaga{vagas !== 1 ? 's' : ''}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {!carregandoSlots && slotsCheios.length > 0 && (
            <>
              <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)',
                letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Esgotados
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {slotsCheios.map(s => (
                  <div key={s.id} style={{ padding: '12px 4px', borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(255,255,255,0.02)', textAlign: 'center', opacity: 0.35 }}>
                    <span style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '0.95rem',
                      fontWeight: 700, color: 'rgba(255,255,255,0.4)', display: 'block' }}>
                      {s.hora.slice(0, 5)}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>Esgotado</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {errosCampos.slot && <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>{errosCampos.slot}</p>}
        </div>
      )}

      {/* PASSO — Documentação */}
      {slotSel && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <span style={stepBadge(false)}>{tipoPessoa === 'DEPENDENTE' ? 5 : 4}</span>
            <p style={{ ...secTitle, margin: 0 }}>Documentação necessária</p>
          </div>

          {/* Texto dos documentos */}
          <div style={{ background: 'rgba(0,128,61,0.06)', border: '1px solid rgba(0,128,61,0.15)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            {DOCS_TEXTO.split('\n').map((linha, i) => (
              <p key={i} style={{
                color: linha.startsWith('•') ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.5)',
                fontSize: linha.startsWith('Conforme') ? '0.78rem' : '0.82rem',
                lineHeight: 1.7, marginBottom: 2,
                fontWeight: linha.startsWith('•') ? 400 : 400,
              }}>
                {linha || '\u00a0'}
              </p>
            ))}
          </div>

          {/* Aceite */}
          <button onClick={() => setCiente(v => !v)} style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
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
            <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
              Estou ciente da documentação exigida e me comprometo a comparecer com os documentos no dia e horário agendados.
            </p>
          </button>
          {errosCampos.ciente && (
            <p style={{ color: 'var(--vermelho)', fontSize: '0.78rem', marginTop: 8 }}>{errosCampos.ciente}</p>
          )}
        </div>
      )}

      {/* Resumo + Botão */}
      {slotSel && ciente && (
        <div>
          <div style={{ background: 'rgba(0,128,61,0.08)', border: '1px solid rgba(0,128,61,0.2)',
            borderRadius: 10, padding: '14px 16px', marginBottom: 16,
            fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.9 }}>
            <strong style={{ color: '#fff', display: 'block', marginBottom: 4 }}>Resumo</strong>
            Agendado para: <strong style={{ color: '#fff' }}>
              {tipoPessoa === 'DEPENDENTE' ? (depNome || '—') : sessao.nome}
            </strong><br/>
            Data: <strong style={{ color: '#fff' }}>
              {DATAS.find(d => d.valor === dataSel)?.label}
            </strong><br/>
            Horário: <strong style={{ color: '#fff' }}>{slotSel.hora.slice(0, 5)}</strong>
          </div>
          <Botao onClick={handleAgendar} carregando={salvando}>
            Confirmar Agendamento
          </Botao>
        </div>
      )}
    </div>
  )
}

// ── Tela de sucesso com QRCode gerado localmente ─────────────
function TelaSucesso({ sucesso, onVoltar, onNovo }) {
  const canvasRef = useRef(null)
  const [qrPronto, setQrPronto] = useState(false)

  useEffect(() => {
    // Gerar QRCode via API pública (sem dependência extra)
    setQrPronto(true)
  }, [])

  const dataLabel = sucesso.data === '2026-06-15' ? '15/06/2026' : '16/06/2026'
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(sucesso.qrCode)}&bgcolor=111827&color=ffffff&margin=14`

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '32px 20px' }}>
      <div style={{ maxWidth: 400, width: '100%', textAlign: 'center' }}>

        <div style={{ width: 60, height: 60, borderRadius: '50%',
          background: 'rgba(0,128,61,0.2)', border: '2px solid var(--verde-base)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', fontSize: '1.5rem' }}>
          ✓
        </div>

        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff', marginBottom: 6 }}>
          Agendamento confirmado!
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem',
          marginBottom: 28, lineHeight: 1.7 }}>
          {sucesso.nomeAgendado}<br/>
          {dataLabel} às {sucesso.hora.slice(0, 5)}
        </p>

        {/* QRCode */}
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 24, marginBottom: 20, display: 'inline-block' }}>
          <img src={qrUrl} alt="QRCode do agendamento"
            style={{ width: 180, height: 180, display: 'block', borderRadius: 8 }}
            onError={e => { e.target.style.display = 'none' }} />
          <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)',
            marginTop: 10, fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {sucesso.qrCode}
          </p>
        </div>

        <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.35)',
          marginBottom: 28, lineHeight: 1.6 }}>
          Tire um print desta tela ou salve o QRCode.<br/>
          Apresente-o no dia do atendimento.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Botao variante="secundario" onClick={onNovo}>Fazer outro agendamento</Botao>
          <Botao onClick={onVoltar}>Voltar ao início</Botao>
        </div>
      </div>
    </div>
  )
}
