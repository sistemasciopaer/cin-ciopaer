import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { formatarCPF } from '@/lib/cpf'
import { Botao } from '@/components/ui/Botao'
import { Alerta } from '@/components/ui/Alerta'

function fmtData(d) {
  if (!d) return ''
  const [y,m,dia] = d.split('-')
  return `${dia}/${m}/${y}`
}

const STATUS_COR  = { AGENDADO:'#00803D', PRESENTE:'#27AE60', CANCELADO:'#E74C3C', REAGENDADO:'#E67E22', NO_SHOW:'#95A5A6' }
const STATUS_LABEL= { AGENDADO:'Agendado', PRESENTE:'Presente', CANCELADO:'Cancelado', REAGENDADO:'Reagendado', NO_SHOW:'Não compareceu' }

export function Relatorios() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [dados, setDados]         = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [filtroData, setFiltroData] = useState('TODOS')
  const [erro, setErro]           = useState('')

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    try {
      const { data: ags } = await db.from('agendamentos')
        .select('id, nome_agendado, cpf_agendado, tipo_pessoa, status, qr_code, criado_em, slot:slots(data, hora)')
        .order('criado_em', { ascending: false })
      const { data: slots } = await db.from('slots')
        .select('id, data, hora, capacidade, ocupacao_atual').order('data').order('hora')
      setDados({ agendamentos: ags ?? [], slots: slots ?? [] })
    } catch { setErro('Erro ao carregar.') }
    finally { setCarregando(false) }
  }

  async function downloadCSV(data) {
    const ags = dados.agendamentos.filter(a =>
      data === 'TODOS' ? true : a.slot?.data === data)
    const linhas = [
      ['Nome','CPF','Tipo','Data','Hora','Status','QRCode'],
      ...ags.map(a => [
        a.nome_agendado, formatarCPF(a.cpf_agendado), a.tipo_pessoa,
        fmtData(a.slot?.data), a.slot?.hora?.slice(0,5), a.status, a.qr_code
      ])
    ]
    const csv = linhas.map(l => l.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `agendamentos_${data === 'TODOS' ? 'todos' : data}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadXLSX(data) {
    const ags = dados.agendamentos.filter(a =>
      data === 'TODOS' ? true : a.slot?.data === data)
    // Usar SheetJS via CDN
    const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs')
    const ws = XLSX.utils.aoa_to_sheet([
      ['Nome','CPF','Tipo','Data','Hora','Status','QRCode'],
      ...ags.map(a => [
        a.nome_agendado, formatarCPF(a.cpf_agendado), a.tipo_pessoa,
        fmtData(a.slot?.data), a.slot?.hora?.slice(0,5), a.status, a.qr_code
      ])
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Agendamentos')
    XLSX.writeFile(wb, `agendamentos_${data === 'TODOS' ? 'todos' : data}.xlsx`)
  }

  async function downloadPDF(data) {
    const ags = dados.agendamentos.filter(a =>
      data === 'TODOS' ? true : a.slot?.data === data)
    const dataLabel = data === 'TODOS' ? 'Ambos os dias' : fmtData(data)

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a2e22; padding: 24px; }
  h1 { color: #00803D; font-size: 16px; margin-bottom: 4px; }
  p.sub { color: #7a9588; font-size: 10px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #00803D; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; }
  td { padding: 6px 8px; border-bottom: 1px solid #d6ddd8; }
  tr:nth-child(even) td { background: #f2f4f3; }
  .status { padding: 2px 6px; border-radius: 10px; font-size: 9px; font-weight: 600; }
</style></head>
<body>
<h1>CIOPAER — Agendamentos CIN</h1>
<p class="sub">Data: ${dataLabel} · Total: ${ags.length} · Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
<table>
<tr><th>Nome</th><th>CPF</th><th>Tipo</th><th>Data</th><th>Hora</th><th>Status</th></tr>
${ags.map(a => `<tr>
  <td>${a.nome_agendado}</td>
  <td>${formatarCPF(a.cpf_agendado)}</td>
  <td>${a.tipo_pessoa}</td>
  <td>${fmtData(a.slot?.data)}</td>
  <td>${a.slot?.hora?.slice(0,5)}</td>
  <td>${a.status}</td>
</tr>`).join('')}
</table>
</body></html>`

    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  if (carregando) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'var(--bg)' }}>
      <p style={{ color:'var(--texto-3)' }}>Carregando relatórios...</p>
    </div>
  )

  const { agendamentos, slots } = dados ?? { agendamentos:[], slots:[] }
  const ags = filtroData === 'TODOS' ? agendamentos : agendamentos.filter(a => a.slot?.data === filtroData)
  const datas = [...new Set(slots.map(s => s.data))].sort()

  const cards = [
    { label:'Total',        valor: ags.length,                                icon:'📋', cor:'var(--verde)' },
    { label:'Agendados',    valor: ags.filter(a => a.status==='AGENDADO').length,  icon:'📅', cor:'var(--verde)' },
    { label:'Presentes',    valor: ags.filter(a => a.status==='PRESENTE').length,  icon:'✓',  cor:'#27AE60' },
    { label:'Cancelados',   valor: ags.filter(a => a.status==='CANCELADO').length, icon:'✗',  cor:'var(--vermelho)' },
    { label:'Não compareceu',valor:ags.filter(a => a.status==='NO_SHOW').length,  icon:'⏱',  cor:'#95A5A6' },
    { label:'Reagendados',  valor: ags.filter(a => a.status==='REAGENDADO').length,icon:'↺',  cor:'var(--laranja)' },
  ]

  const slotsFiltrados = filtroData === 'TODOS' ? slots : slots.filter(s => s.data === filtroData)

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'0 0 60px' }}>
      <div style={{ background:'var(--verde)', padding:'24px 20px 36px' }}>
        <button onClick={() => setPagina('dashboard')} style={{
          background:'rgba(255,255,255,0.2)', border:'none', color:'#fff',
          borderRadius:8, padding:'6px 12px', fontSize:'0.82rem',
          cursor:'pointer', marginBottom:16, fontFamily:'var(--fonte-corpo)' }}>
          ← Voltar
        </button>
        <h2 style={{ fontFamily:'var(--fonte-titulo)', fontSize:'1.3rem', fontWeight:700, color:'#fff' }}>
          Relatórios
        </h2>
      </div>

      <div style={{ padding:'0 16px', marginTop:-16 }}>

        {/* Filtro datas */}
        <div style={{ background:'#fff', border:'1.5px solid var(--borda)', borderRadius:'var(--raio-lg)',
          padding:'14px 16px', marginBottom:14, boxShadow:'var(--sombra)' }}>
          <p style={{ color:'var(--texto-3)', fontSize:'0.72rem', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10 }}>Filtrar por dia</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[{v:'TODOS',l:'Ambos os dias'}, ...datas.map(d => ({v:d,l:fmtData(d)}))].map(op => (
              <button key={op.v} onClick={() => setFiltroData(op.v)} style={{
                padding:'7px 14px', borderRadius:20,
                border:`1.5px solid ${filtroData===op.v ? 'var(--verde)' : 'var(--borda)'}`,
                background: filtroData===op.v ? 'var(--verde-claro)' : '#fff',
                color: filtroData===op.v ? 'var(--verde)' : 'var(--texto-2)',
                fontFamily:'var(--fonte-corpo)', fontSize:'0.8rem',
                fontWeight: filtroData===op.v ? 600 : 400, cursor:'pointer' }}>
                {op.l}
              </button>
            ))}
          </div>
        </div>

        {/* Downloads */}
        <div style={{ background:'#fff', border:'1.5px solid var(--borda)', borderRadius:'var(--raio-lg)',
          padding:'14px 16px', marginBottom:14, boxShadow:'var(--sombra)' }}>
          <p style={{ color:'var(--texto-3)', fontSize:'0.72rem', letterSpacing:'0.08em',
            textTransform:'uppercase', marginBottom:10 }}>
            Download da lista ({ags.length} registros)
          </p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[
              { label:'📄 CSV',  fn: () => downloadCSV(filtroData) },
              { label:'📊 XLSX', fn: () => downloadXLSX(filtroData) },
              { label:'🖨️ PDF',  fn: () => downloadPDF(filtroData) },
            ].map(b => (
              <button key={b.label} onClick={b.fn} style={{
                padding:'9px 18px', borderRadius:10,
                background:'var(--laranja-claro)', border:'1.5px solid var(--laranja)',
                color:'var(--laranja)', fontFamily:'var(--fonte-corpo)',
                fontSize:'0.82rem', fontWeight:600, cursor:'pointer' }}>
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards resumo */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
          {cards.map(c => (
            <div key={c.label} style={{ background:'#fff', border:'1.5px solid var(--borda)',
              borderRadius:'var(--raio-lg)', padding:'16px 12px', textAlign:'center',
              boxShadow:'var(--sombra)' }}>
              <div style={{ fontSize:'1.3rem', marginBottom:6 }}>{c.icon}</div>
              <div style={{ fontFamily:'var(--fonte-titulo)', fontSize:'1.6rem',
                fontWeight:700, color:c.cor, lineHeight:1 }}>{c.valor}</div>
              <div style={{ color:'var(--texto-3)', fontSize:'0.68rem', marginTop:4,
                letterSpacing:'0.04em' }}>{c.label}</div>
            </div>
          ))}
        </div>

        {/* Tabela por hora */}
        <div style={{ background:'#fff', border:'1.5px solid var(--borda)', borderRadius:'var(--raio-lg)',
          overflow:'hidden', boxShadow:'var(--sombra)' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1.5px solid var(--borda)',
            background:'var(--verde-claro)' }}>
            <p style={{ fontFamily:'var(--fonte-titulo)', fontSize:'0.78rem', fontWeight:600,
              color:'var(--verde)', letterSpacing:'0.08em', textTransform:'uppercase' }}>
              Ocupação por horário
            </p>
          </div>
          {slotsFiltrados.map((slot, i) => {
            const agsSlot = ags.filter(a => a.slot?.hora === slot.hora && a.slot?.data === slot.data)
            const presentes  = agsSlot.filter(a => a.status==='PRESENTE').length
            const agendados  = agsSlot.filter(a => a.status==='AGENDADO').length
            const cancelados = agsSlot.filter(a => a.status==='CANCELADO').length
            const pct = Math.round((slot.ocupacao_atual/slot.capacidade)*100)
            return (
              <div key={i} style={{ padding:'12px 16px',
                borderBottom: i < slotsFiltrados.length-1 ? '1px solid var(--borda)' : 'none',
                display:'grid',
                gridTemplateColumns: filtroData==='TODOS' ? '80px 80px 1fr 40px 40px 40px' : '80px 1fr 40px 40px 40px',
                alignItems:'center', gap:8 }}>
                {filtroData==='TODOS' && (
                  <span style={{ color:'var(--texto-3)', fontSize:'0.75rem' }}>{fmtData(slot.data)}</span>
                )}
                <span style={{ fontFamily:'monospace', fontWeight:700, color:'var(--texto)', fontSize:'0.9rem' }}>
                  {slot.hora.slice(0,5)}
                </span>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ flex:1, height:6, background:'var(--borda)', borderRadius:3 }}>
                      <div style={{ height:'100%', borderRadius:3, width:`${pct}%`,
                        background: pct>=100 ? 'var(--vermelho)' : pct>60 ? 'var(--laranja)' : 'var(--verde)',
                        transition:'width 0.3s' }}/>
                    </div>
                    <span style={{ color:'var(--texto-3)', fontSize:'0.7rem', whiteSpace:'nowrap' }}>
                      {slot.ocupacao_atual}/{slot.capacidade}
                    </span>
                  </div>
                </div>
                <span style={{ textAlign:'center', color:'#27AE60', fontSize:'0.85rem', fontWeight:700 }}>
                  {presentes||'—'}
                </span>
                <span style={{ textAlign:'center', color:'var(--verde)', fontSize:'0.85rem', fontWeight:700 }}>
                  {agendados||'—'}
                </span>
                <span style={{ textAlign:'center', color:'var(--vermelho)', fontSize:'0.85rem', fontWeight:700 }}>
                  {cancelados||'—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
