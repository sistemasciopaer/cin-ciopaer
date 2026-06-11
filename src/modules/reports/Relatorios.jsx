import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { formatarCPF } from '@/lib/cpf'
import { Campo } from '@/components/ui/Campo'
import { Alerta } from '@/components/ui/Alerta'

const BRASAO = 'https://blogger.googleusercontent.com/img/a/AVvXsEj0RgZz8nDwXYQitwlZk0ra9PHwj6bc7SYmAhRMH3-kRox-iLeLXVbU35J5Bg-iQhue8QE4L3liniar8pXig3mTQ-ZwsJIqZdh84GjDOASzsG4VMthRMN6V2uicq452NyVEUS85LFEN8yUeWZxT4fYIU05dIs0Sw_uu5ilMhMvDfipiu1B6jBRfNSVhFQk=s1600'

function fmtData(d) {
  if (!d) return ''
  const [y, m, dia] = d.split('-')
  return `${dia}/${m}/${y}`
}
function fmtHora(h) { return h ? h.slice(0, 5) : '' }

const STATUS_COR = {
  AGENDADO:   '#00803D',
  PRESENTE:   '#27AE60',
  CANCELADO:  '#E74C3C',
  REAGENDADO: '#E67E22',
  NO_SHOW:    '#95A5A6',
}
const STATUS_LABEL = {
  AGENDADO:   'Agendado',
  PRESENTE:   'Presente',
  CANCELADO:  'Cancelado',
  REAGENDADO: 'Reagendado',
  NO_SHOW:    'Não compareceu',
}

const card = {
  background: '#fff', border: '1.5px solid var(--borda)',
  borderRadius: 'var(--raio-lg)', padding: '18px',
  marginBottom: 14, boxShadow: 'var(--sombra)',
}

export function Relatorios() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)
  const ehSupervisor = sessao.perfilId >= 2

  const [agendamentos, setAgendamentos] = useState([])
  const [slots, setSlots]               = useState([])
  const [carregando, setCarregando]     = useState(true)
  const [erro, setErro]                 = useState('')
  const [filtroData, setFiltroData]     = useState('TODOS')
  const [filtroStatus, setFiltroStatus] = useState('TODOS')
  const [busca, setBusca]               = useState('')
  const [aba, setAba]                   = useState('resumo')
  const [confirmando, setConfirmando]   = useState({})

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const { data: ags } = await db
        .from('agendamentos')
        .select(`id, nome_agendado, cpf_agendado, tipo_pessoa,
                 status, qr_code, criado_em,
                 slot:slots(data, hora),
                 responsavel:servidores!servidor_responsavel_id(nome, matricula)`)
        .order('criado_em', { ascending: false })
      const { data: sls } = await db
        .from('slots')
        .select('id, data, hora, capacidade, ocupacao_atual')
        .order('data').order('hora')
      setAgendamentos(ags ?? [])
      setSlots(sls ?? [])
    } catch { setErro('Erro ao carregar dados.') }
    finally { setCarregando(false) }
  }

  async function confirmarPresenca(ag) {
    setConfirmando(prev => ({ ...prev, [ag.id]: true }))
    try {
      await db.from('presencas').insert({
        agendamento_id: ag.id,
        confirmado_por: sessao.servidorId,
        metodo: 'PESQUISA',
      })
      await db.from('agendamentos').update({ status: 'PRESENTE' }).eq('id', ag.id)
      setAgendamentos(prev => prev.map(a =>
        a.id === ag.id ? { ...a, status: 'PRESENTE' } : a
      ))
    } catch (e) {
      setErro('Erro ao confirmar presença: ' + (e.message ?? ''))
    } finally {
      setConfirmando(prev => ({ ...prev, [ag.id]: false }))
    }
  }

  async function desfazerPresenca(ag) {
    setConfirmando(prev => ({ ...prev, [ag.id]: true }))
    try {
      await db.from('presencas').delete().eq('agendamento_id', ag.id)
      await db.from('agendamentos').update({ status: 'AGENDADO' }).eq('id', ag.id)
      setAgendamentos(prev => prev.map(a =>
        a.id === ag.id ? { ...a, status: 'AGENDADO' } : a
      ))
    } catch (e) {
      setErro('Erro ao desfazer presença: ' + (e.message ?? ''))
    } finally {
      setConfirmando(prev => ({ ...prev, [ag.id]: false }))
    }
  }

  const agsFiltrados = agendamentos.filter(a => {
    const porData   = filtroData === 'TODOS' || a.slot?.data === filtroData
    const porStatus = filtroStatus === 'TODOS' || a.status === filtroStatus
    const porBusca  = busca.trim() === '' ||
      a.nome_agendado.toLowerCase().includes(busca.toLowerCase()) ||
      a.cpf_agendado.includes(busca.replace(/\D/g, ''))
    return porData && porStatus && porBusca
  })

  const datas = [...new Set(slots.map(s => s.data))].sort()

  function agrupadoPorDataHora(lista) {
    const grupos = {}
    lista.forEach(a => {
      if (!a.slot) return
      const chave = `${a.slot.data}|${a.slot.hora}`
      if (!grupos[chave]) {
        grupos[chave] = { data: a.slot.data, hora: a.slot.hora, itens: [] }
      }
      grupos[chave].itens.push(a)
    })
    const resultado = Object.values(grupos)
    resultado.forEach(g => {
      g.itens.sort((a, b) =>
        a.nome_agendado.localeCompare(b.nome_agendado, 'pt-BR', { sensitivity: 'base' })
      )
    })
    resultado.sort((a, b) =>
      a.data !== b.data
        ? a.data.localeCompare(b.data)
        : a.hora.localeCompare(b.hora)
    )
    return resultado
  }

  const ags = filtroData === 'TODOS'
    ? agendamentos
    : agendamentos.filter(a => a.slot?.data === filtroData)

  const cards = [
    { label: 'Total',          valor: ags.length,                                       icon: '📋', cor: 'var(--verde)' },
    { label: 'Agendados',      valor: ags.filter(a => a.status === 'AGENDADO').length,   icon: '📅', cor: 'var(--verde)' },
    { label: 'Presentes',      valor: ags.filter(a => a.status === 'PRESENTE').length,   icon: '✓',  cor: '#27AE60' },
    { label: 'Cancelados',     valor: ags.filter(a => a.status === 'CANCELADO').length,  icon: '✗',  cor: 'var(--vermelho)' },
    { label: 'Não compareceu', valor: ags.filter(a => a.status === 'NO_SHOW').length,    icon: '⏱',  cor: '#95A5A6' },
    { label: 'Reagendados',    valor: ags.filter(a => a.status === 'REAGENDADO').length, icon: '↺',  cor: 'var(--laranja)' },
  ]

  function downloadCSV() {
    const grupos = agrupadoPorDataHora(agsFiltrados)
    const linhas = [['Data','Horário','Nome','CPF','Tipo','Status','Responsável']]
    grupos.forEach(g => g.itens.forEach(a => linhas.push([
      fmtData(g.data), fmtHora(g.hora), a.nome_agendado,
      formatarCPF(a.cpf_agendado),
      a.tipo_pessoa === 'SERVIDOR' ? 'Titular' : 'Dependente',
      STATUS_LABEL[a.status] ?? a.status,
      a.responsavel?.nome ?? '',
    ])))
    const csv  = linhas.map(l => l.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const el   = document.createElement('a')
    el.href = url
    el.download = `agendamentos_cin_${filtroData === 'TODOS' ? 'todos' : filtroData}.csv`
    el.click()
    URL.revokeObjectURL(url)
  }

  function downloadPDF() {
    const grupos = agrupadoPorDataHora(agsFiltrados)
    const dataLabel = filtroData === 'TODOS' ? 'Todos os dias' : fmtData(filtroData)
    let tabelaHTML = ''
    grupos.forEach(g => {
      const slot       = slots.find(s => s.data === g.data && s.hora === g.hora)
      const ocupados   = g.itens.filter(a => ['AGENDADO','PRESENTE'].includes(a.status)).length
      const capacidade = slot?.capacidade ?? 5
      tabelaHTML += `
        <div class="grupo">
          <div class="grupo-header">
            <span class="grupo-data">${fmtData(g.data)}</span>
            <span class="grupo-hora">${fmtHora(g.hora)}</span>
            <span class="grupo-vagas">${ocupados}/${capacidade} vagas</span>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Nome</th><th>CPF</th><th>Tipo</th><th>Status</th><th>Responsável</th></tr>
            </thead>
            <tbody>
              ${g.itens.map((a, i) => `
                <tr class="${a.status === 'PRESENTE' ? 'presente' : ''}">
                  <td>${i + 1}</td>
                  <td>${a.nome_agendado}</td>
                  <td>${formatarCPF(a.cpf_agendado)}</td>
                  <td>${a.tipo_pessoa === 'SERVIDOR' ? 'Titular' : 'Dependente'}</td>
                  <td style="color:${STATUS_COR[a.status] ?? '#333'};font-weight:600">
                    ${STATUS_LABEL[a.status] ?? a.status}
                  </td>
                  <td>${a.responsavel?.nome?.split(' ').slice(0, 2).join(' ') ?? ''}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`
    })

    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width"/>
<style>
  @page { margin: 20mm 15mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1a2e22; }
  .cabecalho { display:flex; align-items:center; gap:16px; border-bottom:3px solid #00803D; padding-bottom:12px; margin-bottom:16px; }
  .cabecalho img { height:70px; width:auto; }
  .cabecalho-texto h1 { font-size:16px; color:#00803D; margin:0 0 4px; }
  .cabecalho-texto p { font-size:10px; color:#4a6355; margin:0; }
  .meta { display:flex; gap:20px; background:#e8f5ee; border:1px solid #00803D; border-radius:6px; padding:8px 14px; margin-bottom:16px; font-size:10px; color:#006830; flex-wrap:wrap; }
  .grupo { margin-bottom:20px; page-break-inside:avoid; }
  .grupo-header { background:#00803D; color:#fff; padding:7px 12px; border-radius:6px 6px 0 0; display:flex; gap:16px; align-items:center; }
  .grupo-data { font-weight:700; font-size:11px; }
  .grupo-hora { font-size:13px; font-weight:700; }
  .grupo-vagas { margin-left:auto; font-size:10px; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px; }
  table { width:100%; border-collapse:collapse; border:1px solid #d6ddd8; border-top:none; }
  th { background:#f2f4f3; padding:6px 8px; text-align:left; font-size:9px; text-transform:uppercase; color:#4a6355; border-bottom:1px solid #d6ddd8; }
  td { padding:6px 8px; border-bottom:1px solid #edf0ee; font-size:10px; }
  tr:last-child td { border-bottom:none; }
  tr:nth-child(even) td { background:#f9fafb; }
  tr.presente td { background:#e8f5ee !important; }
  .imprimir { display:block; margin:20px auto; padding:12px 32px; background:#00803D; color:#fff; border:none; border-radius:8px; font-size:14px; font-family:Arial,sans-serif; cursor:pointer; }
  .rodape { margin-top:20px; border-top:1px solid #d6ddd8; padding-top:8px; font-size:9px; color:#7a9588; text-align:center; }
  @media print { .imprimir { display:none; } }
</style></head><body>
<div class="cabecalho">
  <img src="${BRASAO}" alt="CIOPAER" onerror="this.style.display='none'"/>
  <div class="cabecalho-texto">
    <h1>CIOPAER</h1>
    <p>Relação de Agendamentos — Emissão da CIN</p>
  </div>
</div>
<div class="meta">
  <span><strong>Período:</strong> ${dataLabel}</span>
  <span><strong>Total:</strong> ${agsFiltrados.length} agendamentos</span>
  <span><strong>Gerado em:</strong> ${new Date().toLocaleString('pt-BR')}</span>
</div>
${tabelaHTML}
<button class="imprimir" onclick="window.print()">Imprimir / Salvar PDF</button>
<div class="rodape">Sistema de Agendamentos CIOPAER — Documento gerado automaticamente</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const el   = document.createElement('a')
    el.href     = url
    el.download = `relatorio_cin_${filtroData === 'TODOS' ? 'todos' : filtroData}.html`
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  if (carregando) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'var(--bg)' }}>
      <p style={{ color:'var(--texto-3)' }}>Carregando...</p>
    </div>
  )

  const grupos = agrupadoPorDataHora(agsFiltrados)

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'0 0 60px' }}>
      <div style={{ background:'var(--verde)', padding:'24px 20px 36px' }}>
        <button onClick={() => setPagina('dashboard')} style={{
          background:'rgba(255,255,255,0.2)', border:'none', color:'#fff',
          borderRadius:8, padding:'6px 12px', fontSize:'0.82rem',
          cursor:'pointer', marginBottom:16, fontFamily:'var(--fonte-corpo)',
        }}>{String.fromCharCode(8592)} Voltar</button>
        <h2 style={{ fontFamily:'var(--fonte-titulo)', fontSize:'1.3rem',
          fontWeight:700, color:'#fff' }}>Relatórios</h2>
      </div>

      <div style={{ padding:'0 16px', marginTop:-16 }}>
        {erro && <div style={{ marginBottom:14 }}><Alerta tipo="erro">{erro}</Alerta></div>}

        <div style={{ ...card, padding:'12px 14px' }}>
          <p style={{ color:'var(--texto-3)', fontSize:'0.7rem', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10 }}>Filtrar por dia</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[{ v:'TODOS', l:'Todos' }, ...datas.map(d => ({ v:d, l:fmtData(d) }))].map(op => (
              <button key={op.v} onClick={() => setFiltroData(op.v)} style={{
                padding:'7px 14px', borderRadius:20,
                border:`1.5px solid ${filtroData===op.v ? 'var(--verde)' : 'var(--borda)'}`,
                background: filtroData===op.v ? 'var(--verde-claro)' : '#fff',
                color: filtroData===op.v ? 'var(--verde)' : 'var(--texto-2)',
                fontFamily:'var(--fonte-corpo)', fontSize:'0.8rem',
                fontWeight: filtroData===op.v ? 700 : 400, cursor:'pointer',
              }}>{op.l}</button>
            ))}
          </div>
        </div>

        <div style={{ ...card, padding:'12px 14px' }}>
          <p style={{ color:'var(--texto-3)', fontSize:'0.7rem', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10 }}>
            Download ({agsFiltrados.length} registros)
          </p>
          <div style={{ display:'flex', gap:8 }}>
            {[
              { label:'📄 CSV', fn: downloadCSV },
              { label:'📋 Relatório', fn: downloadPDF },
            ].map(b => (
              <button key={b.label} onClick={b.fn} style={{
                padding:'9px 18px', borderRadius:10,
                background:'var(--laranja-claro)', border:'1.5px solid var(--laranja)',
                color:'var(--laranja)', fontFamily:'var(--fonte-corpo)',
                fontSize:'0.82rem', fontWeight:600, cursor:'pointer',
              }}>{b.label}</button>
            ))}
          </div>
          <p style={{ color:'var(--texto-3)', fontSize:'0.7rem', marginTop:8, lineHeight:1.5 }}>
            O relatório é baixado como arquivo HTML. Abra-o e toque em
            {' '}<strong>Imprimir / Salvar PDF</strong> para gerar o PDF.
          </p>
        </div>

        <div style={{ ...card, padding:'6px', display:'flex', gap:4 }}>
          {[
            { val:'resumo', label:'📊 Resumo' },
            { val:'lista',  label:'📋 Por horário' },
            { val:'busca',  label:'🔍 Buscar' },
          ].map(a => (
            <button key={a.val} onClick={() => setAba(a.val)} style={{
              flex:1, padding:'10px 4px', borderRadius:10,
              background: aba===a.val ? 'var(--verde)' : 'transparent',
              color: aba===a.val ? '#fff' : 'var(--texto-2)',
              fontFamily:'var(--fonte-corpo)', fontSize:'0.78rem',
              fontWeight: aba===a.val ? 700 : 400, border:'none', cursor:'pointer',
            }}>{a.label}</button>
          ))}
        </div>

        {aba === 'resumo' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
              {cards.map(c => (
                <div key={c.label} style={{ background:'#fff', border:'1.5px solid var(--borda)',
                  borderRadius:'var(--raio-lg)', padding:'16px 10px',
                  textAlign:'center', boxShadow:'var(--sombra)' }}>
                  <div style={{ fontSize:'1.3rem', marginBottom:6 }}>{c.icon}</div>
                  <div style={{ fontFamily:'var(--fonte-titulo)', fontSize:'1.6rem',
                    fontWeight:700, color:c.cor, lineHeight:1 }}>{c.valor}</div>
                  <div style={{ color:'var(--texto-3)', fontSize:'0.65rem', marginTop:4 }}>
                    {c.label}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background:'#fff', border:'1.5px solid var(--borda)',
              borderRadius:'var(--raio-lg)', overflow:'hidden', boxShadow:'var(--sombra)' }}>
              <div style={{ padding:'12px 16px', background:'var(--verde-claro)',
                borderBottom:'1.5px solid var(--borda)' }}>
                <p style={{ fontFamily:'var(--fonte-titulo)', fontSize:'0.78rem', fontWeight:600,
                  color:'var(--verde)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                  Ocupação por horário
                </p>
              </div>
              {(filtroData === 'TODOS' ? slots : slots.filter(s => s.data === filtroData))
                .map((slot, i, arr) => {
                  const pct = Math.round((slot.ocupacao_atual / slot.capacidade) * 100)
                  const presentes = agendamentos.filter(a =>
                    a.slot?.data === slot.data &&
                    a.slot?.hora === slot.hora &&
                    a.status === 'PRESENTE').length
                  const agendados = agendamentos.filter(a =>
                    a.slot?.data === slot.data &&
                    a.slot?.hora === slot.hora &&
                    a.status === 'AGENDADO').length
                  return (
                    <div key={slot.id} style={{
                      padding:'10px 16px',
                      borderBottom: i < arr.length - 1 ? '1px solid var(--borda)' : 'none',
                      display:'grid',
                      gridTemplateColumns: filtroData === 'TODOS'
                        ? '72px 64px 1fr 36px 36px'
                        : '64px 1fr 36px 36px',
                      alignItems:'center', gap:8,
                    }}>
                      {filtroData === 'TODOS' && (
                        <span style={{ color:'var(--texto-3)', fontSize:'0.72rem' }}>
                          {fmtData(slot.data)}
                        </span>
                      )}
                      <span style={{ fontFamily:'monospace', fontWeight:700,
                        color:'var(--texto)', fontSize:'0.88rem' }}>
                        {fmtHora(slot.hora)}
                      </span>
                      <div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ flex:1, height:6, background:'var(--borda)', borderRadius:3 }}>
                            <div style={{ height:'100%', borderRadius:3, width:`${pct}%`,
                              background: pct>=100 ? 'var(--vermelho)' :
                                          pct>60  ? 'var(--laranja)' : 'var(--verde)',
                              transition:'width 0.3s' }}/>
                          </div>
                          <span style={{ color:'var(--texto-3)', fontSize:'0.7rem', whiteSpace:'nowrap' }}>
                            {slot.ocupacao_atual}/{slot.capacidade}
                          </span>
                        </div>
                      </div>
                      <span style={{ textAlign:'center', color:'#27AE60',
                        fontSize:'0.82rem', fontWeight:700 }}>
                        {presentes || '—'}
                      </span>
                      <span style={{ textAlign:'center', color:'var(--verde)',
                        fontSize:'0.82rem', fontWeight:700 }}>
                        {agendados || '—'}
                      </span>
                    </div>
                  )
                })}
            </div>
          </>
        )}

        {aba === 'lista' && (
          <div>
            <div style={{ ...card, padding:'10px 14px', display:'flex', gap:8, flexWrap:'wrap' }}>
              {['TODOS','AGENDADO','PRESENTE','CANCELADO','NO_SHOW'].map(f => (
                <button key={f} onClick={() => setFiltroStatus(f)} style={{
                  padding:'5px 12px', borderRadius:20,
                  border:`1.5px solid ${filtroStatus===f ? 'var(--verde)' : 'var(--borda)'}`,
                  background: filtroStatus===f ? 'var(--verde-claro)' : '#fff',
                  color: filtroStatus===f ? 'var(--verde)' : 'var(--texto-2)',
                  fontFamily:'var(--fonte-corpo)', fontSize:'0.72rem',
                  fontWeight: filtroStatus===f ? 700 : 400, cursor:'pointer',
                }}>
                  {f === 'TODOS' ? 'Todos' : STATUS_LABEL[f]}
                </button>
              ))}
            </div>

            {grupos.length === 0 && (
              <p style={{ color:'var(--texto-3)', textAlign:'center', padding:30 }}>
                Nenhum agendamento encontrado.
              </p>
            )}

            {grupos.map(g => (
              <div key={`${g.data}|${g.hora}`} style={{ marginBottom:14 }}>
                <div style={{ background:'var(--verde)', borderRadius:'10px 10px 0 0',
                  padding:'10px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ color:'rgba(255,255,255,0.8)', fontSize:'0.78rem' }}>
                    {fmtData(g.data)}
                  </span>
                  <span style={{ color:'#fff', fontFamily:'var(--fonte-titulo)',
                    fontSize:'1.1rem', fontWeight:700 }}>
                    {fmtHora(g.hora)}
                  </span>
                  <span style={{ marginLeft:'auto', background:'rgba(255,255,255,0.2)',
                    color:'#fff', fontSize:'0.72rem', padding:'3px 10px', borderRadius:12 }}>
                    {g.itens.filter(a => a.status === 'PRESENTE').length} presentes
                    {' · '}{g.itens.length} total
                  </span>
                </div>

                <div style={{ background:'#fff', border:'1.5px solid var(--borda)',
                  borderTop:'none', borderRadius:'0 0 10px 10px',
                  overflow:'hidden', boxShadow:'var(--sombra)' }}>
                  {g.itens.map((a, i) => {
                    const presente       = a.status === 'PRESENTE'
                    const podeMexer      = ehSupervisor && ['AGENDADO','PRESENTE'].includes(a.status)
                    const carregandoEste = confirmando[a.id]
                    return (
                      <div key={a.id} style={{
                        padding:'12px 16px',
                        borderBottom: i < g.itens.length - 1 ? '1px solid var(--borda)' : 'none',
                        display:'flex', alignItems:'center', gap:12,
                        background: presente ? '#f0faf5' : '#fff',
                        transition:'background 0.2s',
                      }}>
                        <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0,
                          background: presente ? '#27AE60' : 'var(--bg)',
                          border:`1px solid ${presente ? '#27AE60' : 'var(--borda)'}`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'0.7rem', fontWeight:700,
                          color: presente ? '#fff' : 'var(--texto-3)',
                          transition:'all 0.2s' }}>
                          {presente ? '✓' : i + 1}
                        </div>

                        <div style={{ flex:1 }}>
                          <p style={{
                            color: presente ? '#006830' : 'var(--texto)',
                            fontWeight: presente ? 700 : 600,
                            fontSize:'0.88rem', marginBottom:2,
                            transition:'color 0.2s',
                          }}>
                            {a.nome_agendado}
                          </p>
                          <p style={{ color:'var(--texto-3)', fontSize:'0.72rem' }}>
                            {formatarCPF(a.cpf_agendado)}
                            {a.tipo_pessoa === 'DEPENDENTE' && ' · Dependente'}
                          </p>
                        </div>

                        {podeMexer && (
                          <button
                            onClick={() => presente ? desfazerPresenca(a) : confirmarPresenca(a)}
                            disabled={carregandoEste}
                            title={presente ? 'Desfazer presença' : 'Confirmar presença'}
                            style={{
                              width:36, height:36, borderRadius:'50%', flexShrink:0,
                              border:`2px solid ${presente ? '#27AE60' : 'var(--borda)'}`,
                              background: presente ? '#27AE60' : '#fff',
                              color: presente ? '#fff' : 'var(--texto-3)',
                              fontSize:'1rem',
                              cursor: carregandoEste ? 'wait' : 'pointer',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              transition:'all 0.2s',
                              opacity: carregandoEste ? 0.5 : 1,
                            }}>
                            {carregandoEste ? '…' : '✓'}
                          </button>
                        )}

                        {!podeMexer && (
                          <span style={{ fontSize:'0.68rem', fontWeight:600,
                            padding:'3px 8px', borderRadius:12,
                            background:`${STATUS_COR[a.status] ?? '#888'}15`,
                            color: STATUS_COR[a.status] ?? '#888',
                            border:`1px solid ${STATUS_COR[a.status] ?? '#888'}40`,
                            whiteSpace:'nowrap' }}>
                            {STATUS_LABEL[a.status] ?? a.status}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === 'busca' && (
          <div>
            <div style={{ marginBottom:14 }}>
              <Campo type="text" value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou CPF..." />
            </div>

            {busca.trim() === '' && (
              <p style={{ color:'var(--texto-3)', textAlign:'center',
                padding:30, fontSize:'0.88rem' }}>
                Digite um nome ou CPF para buscar.
              </p>
            )}

            {busca.trim() !== '' && agsFiltrados.length === 0 && (
              <p style={{ color:'var(--texto-3)', textAlign:'center', padding:20 }}>
                Nenhum resultado para "{busca}".
              </p>
            )}

            {busca.trim() !== '' && agsFiltrados.map(a => {
              const cor = STATUS_COR[a.status] ?? '#888'
              return (
                <div key={a.id} style={{ background:'#fff',
                  border:'1.5px solid var(--borda)',
                  borderRadius:'var(--raio-lg)', padding:'14px 16px',
                  boxShadow:'var(--sombra)', marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'flex-start', marginBottom:8 }}>
                    <div style={{ flex:1 }}>
                      <p style={{ color:'var(--texto)', fontWeight:600,
                        fontSize:'0.92rem', marginBottom:3 }}>
                        {a.nome_agendado}
                      </p>
                      <p style={{ color:'var(--texto-3)', fontSize:'0.75rem' }}>
                        {formatarCPF(a.cpf_agendado)}
                        {a.tipo_pessoa === 'DEPENDENTE' && ' · Dependente'}
                      </p>
                    </div>
                    <span style={{ fontSize:'0.7rem', fontWeight:600,
                      padding:'4px 10px', borderRadius:20,
                      background:`${cor}15`, color:cor,
                      border:`1px solid ${cor}40`,
                      marginLeft:12, whiteSpace:'nowrap' }}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:16,
                    paddingTop:8, borderTop:'1px solid var(--borda)' }}>
                    <div>
                      <span style={{ color:'var(--texto-3)', fontSize:'0.7rem' }}>Data</span>
                      <p style={{ color:'var(--texto)', fontWeight:600, fontSize:'0.82rem' }}>
                        {a.slot ? fmtData(a.slot.data) : '—'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color:'var(--texto-3)', fontSize:'0.7rem' }}>Horário</span>
                      <p style={{ color:'var(--texto)', fontWeight:600, fontSize:'0.82rem' }}>
                        {a.slot ? fmtHora(a.slot.hora) : '—'}
                      </p>
                    </div>
                    <div>
                      <span style={{ color:'var(--texto-3)', fontSize:'0.7rem' }}>Responsável</span>
                      <p style={{ color:'var(--texto)', fontWeight:600, fontSize:'0.82rem' }}>
                        {a.responsavel?.nome?.split(' ').slice(0, 2).join(' ') ?? '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
