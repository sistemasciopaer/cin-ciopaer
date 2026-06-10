import { useState, useEffect } from 'react'
import { useStore } from '@/lib/store'
import { supabaseAutenticado } from '@/lib/supabase'
import { normalizarCPF, validarCPF } from '@/lib/cpf'
import { traduzirErro } from '@/lib/erros'
import { Botao } from '@/components/ui/Botao'
import { Campo } from '@/components/ui/Campo'
import { Alerta } from '@/components/ui/Alerta'

const PERFIS = { 1: 'Servidor', 2: 'Supervisor', 3: 'Administrador' }
const DEP_NOVO = { matricula:'', cpf:'', nome:'', email:'', perfil_id: 1 }

const card = {
  background: '#fff', border: '1.5px solid var(--borda)',
  borderRadius: 'var(--raio-lg)', padding: '18px',
  marginBottom: 14, boxShadow: 'var(--sombra)',
}

export function GerenciarUsuarios() {
  const { sessao, setPagina } = useStore()
  const db = supabaseAutenticado(sessao.token)

  const [aba, setAba]                 = useState('lista')
  const [todos, setTodos]             = useState([])
  const [busca, setBusca]             = useState('')
  const [carregando, setCarregando]   = useState(true)
  const [selecionado, setSelecionado] = useState(null)
  const [salvando, setSalvando]       = useState(false)
  const [erro, setErro]               = useState('')
  const [sucesso, setSucesso]         = useState('')
  const [novo, setNovo]               = useState(DEP_NOVO)
  const [errosNovo, setErrosNovo]     = useState({})

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setCarregando(true)
    setErro('')
    const { data, error } = await db
      .from('servidores')
      .select('id, matricula, cpf, nome, email, perfil_id, ativo')
      .order('nome')
    setCarregando(false)
    if (error) { setErro('Erro ao carregar: ' + error.message); return }
    setTodos(data ?? [])
  }

  const filtrados = todos.filter(s => {
    if (!busca.trim()) return true
    const q = busca.toLowerCase().trim()
    const cpfLimpo = q.replace(/\D/g, '')
    return (
      s.nome.toLowerCase().includes(q) ||
      s.matricula.toLowerCase().includes(q) ||
      (cpfLimpo && s.cpf.includes(cpfLimpo))
    )
  })

  async function salvarPerfil() {
    if (!selecionado) return
    setSalvando(true); setErro(''); setSucesso('')
    try {
      const { error } = await db
        .from('servidores')
        .update({
          perfil_id: parseInt(selecionado.perfil_id, 10),
          ativo:     Boolean(selecionado.ativo),
        })
        .eq('id', selecionado.id)
        .select()
      if (error) throw error
      setSucesso(`Perfil de ${selecionado.nome.split(' ')[0]} atualizado.`)
      setSelecionado(null)
      await carregar()
    } catch (e) {
      setErro('Erro ao salvar: ' + (e.message ?? 'Verifique as permissões no Supabase.'))
    } finally {
      setSalvando(false)
    }
  }

  function validarNovo() {
    const e = {}
    if (!novo.matricula.trim())    e.matricula = 'Obrigatório.'
    if (!validarCPF(novo.cpf))     e.cpf       = 'CPF inválido.'
    if (!novo.nome.trim())         e.nome      = 'Obrigatório.'
    if (!novo.email.includes('@')) e.email     = 'Email inválido.'
    setErrosNovo(e)
    return Object.keys(e).length === 0
  }

  async function adicionarServidor() {
    if (!validarNovo()) return
    setSalvando(true); setErro(''); setSucesso('')
    try {
      const { error } = await db.from('servidores').insert({
        matricula: novo.matricula.trim(),
        cpf:       normalizarCPF(novo.cpf),
        nome:      novo.nome.trim().toUpperCase(),
        email:     novo.email.trim(),
        perfil_id: parseInt(novo.perfil_id, 10),
        ativo:     true,
      })
      if (error) throw error
      setSucesso(`${novo.nome.split(' ')[0]} cadastrado com sucesso.`)
      setNovo(DEP_NOVO)
      setErrosNovo({})
      await carregar()
    } catch (e) {
      setErro('Erro ao cadastrar: ' + (e.message ?? ''))
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:'0 0 60px' }}>
      <div style={{ background:'var(--verde)', padding:'24px 20px 36px' }}>
        <button onClick={() => setPagina('admin')} style={{
          background:'rgba(255,255,255,0.2)', border:'none', color:'#fff',
          borderRadius:8, padding:'6px 12px', fontSize:'0.82rem',
          cursor:'pointer', marginBottom:16, fontFamily:'var(--fonte-corpo)',
        }}>{String.fromCharCode(8592)} Voltar</button>
        <h2 style={{ fontFamily:'var(--fonte-titulo)', fontSize:'1.3rem',
          fontWeight:700, color:'#fff' }}>Gerenciar Usuários</h2>
      </div>

      <div style={{ padding:'0 16px', marginTop:-16 }}>

        <div style={{ ...card, padding:'6px', display:'flex', gap:4 }}>
          {[
            { val:'lista', label:`👥 Lista (${todos.length})` },
            { val:'novo',  label:'➕ Adicionar' },
            { val:'csv',   label:'📥 Importar' },
          ].map(a => (
            <button key={a.val}
              onClick={() => {
                setAba(a.val); setErro(''); setSucesso(''); setSelecionado(null)
              }}
              style={{ flex:1, padding:'10px 4px', borderRadius:10,
                background: aba===a.val ? 'var(--verde)' : 'transparent',
                color: aba===a.val ? '#fff' : 'var(--texto-2)',
                fontFamily:'var(--fonte-corpo)', fontSize:'0.78rem',
                fontWeight: aba===a.val ? 700 : 400, border:'none', cursor:'pointer' }}>
              {a.label}
            </button>
          ))}
        </div>

        {erro    && <div style={{ marginBottom:14 }}><Alerta tipo="erro">{erro}</Alerta></div>}
        {sucesso && <div style={{ marginBottom:14 }}><Alerta tipo="sucesso">{sucesso}</Alerta></div>}

        {/* LISTA */}
        {aba === 'lista' && (
          <>
            {selecionado ? (
              <div style={card}>
                <div style={{ display:'flex', justifyContent:'space-between',
                  alignItems:'center', marginBottom:16 }}>
                  <p style={{ fontFamily:'var(--fonte-titulo)', fontWeight:600,
                    color:'var(--texto)', fontSize:'0.95rem' }}>Editar Perfil</p>
                  <button
                    onClick={() => { setSelecionado(null); setErro(''); setSucesso('') }}
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:'var(--texto-3)', fontSize:'1.3rem', lineHeight:1 }}>
                    {String.fromCharCode(215)}
                  </button>
                </div>

                <p style={{ fontWeight:600, color:'var(--texto)', marginBottom:2 }}>
                  {selecionado.nome}
                </p>
                <p style={{ color:'var(--texto-3)', fontSize:'0.82rem', marginBottom:16 }}>
                  Mat. {selecionado.matricula} · {selecionado.email}
                </p>

                <label style={{ fontSize:'0.75rem', color:'var(--texto-2)',
                  letterSpacing:'0.06em', textTransform:'uppercase',
                  fontWeight:600, display:'block', marginBottom:8 }}>
                  Perfil atual:{' '}
                  <span style={{ color:'var(--verde)' }}>
                    {PERFIS[selecionado.perfil_id]}
                  </span>
                </label>

                <div style={{ display:'flex', gap:8, marginBottom:16 }}>
                  {Object.entries(PERFIS).map(([id, nome]) => (
                    <button key={id}
                      onClick={() => setSelecionado(s => ({
                        ...s, perfil_id: parseInt(id, 10)
                      }))}
                      style={{
                        flex:1, padding:'10px 4px', borderRadius:10,
                        border:`2px solid ${
                          selecionado.perfil_id === parseInt(id, 10)
                            ? 'var(--verde)' : 'var(--borda)'
                        }`,
                        background: selecionado.perfil_id === parseInt(id, 10)
                          ? 'var(--verde-claro)' : '#fff',
                        color: selecionado.perfil_id === parseInt(id, 10)
                          ? 'var(--verde)' : 'var(--texto-2)',
                        fontFamily:'var(--fonte-corpo)', fontSize:'0.75rem',
                        fontWeight: selecionado.perfil_id === parseInt(id, 10) ? 700 : 400,
                        cursor:'pointer',
                      }}>
                      {nome}
                    </button>
                  ))}
                </div>

                <label style={{ display:'flex', alignItems:'center', gap:10,
                  cursor:'pointer', marginBottom:16 }}>
                  <input type="checkbox"
                    checked={Boolean(selecionado.ativo)}
                    onChange={e => setSelecionado(s => ({ ...s, ativo: e.target.checked }))}
                    style={{ width:18, height:18, accentColor:'var(--verde)' }} />
                  <span style={{ color:'var(--texto-2)', fontSize:'0.88rem' }}>
                    Conta ativa
                  </span>
                </label>

                <Botao variante="verde" onClick={salvarPerfil} carregando={salvando}>
                  Salvar alterações
                </Botao>
              </div>
            ) : (
              <>
                <div style={{ marginBottom:12 }}>
                  <Campo type="text" value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar por nome, matrícula ou CPF..." />
                </div>
                <p style={{ color:'var(--texto-3)', fontSize:'0.75rem',
                  marginBottom:10, textAlign:'right' }}>
                  {filtrados.length} de {todos.length} servidor(es)
                </p>
                {carregando ? (
                  <p style={{ color:'var(--texto-3)', textAlign:'center', padding:20 }}>
                    Carregando...
                  </p>
                ) : filtrados.length === 0 ? (
                  <p style={{ color:'var(--texto-3)', textAlign:'center', padding:20 }}>
                    {busca.trim()
                      ? `Nenhum resultado para "${busca}".`
                      : 'Nenhum servidor cadastrado.'}
                  </p>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {filtrados.map(s => (
                      <button key={s.id}
                        onClick={() => {
                          setSelecionado({ ...s, perfil_id: parseInt(s.perfil_id, 10) })
                          setErro(''); setSucesso('')
                        }}
                        style={{
                          background:'#fff', border:'1.5px solid var(--borda)',
                          borderRadius:'var(--raio-lg)', padding:'14px 16px',
                          cursor:'pointer', textAlign:'left', width:'100%',
                          display:'flex', justifyContent:'space-between', alignItems:'center',
                          opacity: s.ativo ? 1 : 0.5,
                          fontFamily:'var(--fonte-corpo)', boxShadow:'var(--sombra)',
                          transition:'border-color 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--verde)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--borda)'}>
                        <div>
                          <p style={{ fontWeight:600, color:'var(--texto)', fontSize:'0.88rem' }}>
                            {s.nome}
                          </p>
                          <p style={{ color:'var(--texto-3)', fontSize:'0.75rem', marginTop:2 }}>
                            Mat. {s.matricula} · {PERFIS[s.perfil_id]}
                            {!s.ativo && ' · Inativo'}
                          </p>
                        </div>
                        <span style={{ color:'var(--texto-3)' }}>›</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* NOVO */}
        {aba === 'novo' && (
          <div style={card}>
            <p style={{ fontFamily:'var(--fonte-titulo)', fontWeight:600,
              color:'var(--texto)', fontSize:'0.95rem', marginBottom:18 }}>
              Novo Servidor
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Campo label="Matrícula" type="text" value={novo.matricula}
                onChange={e => setNovo(n => ({ ...n, matricula: e.target.value }))}
                erro={errosNovo.matricula} />
              <Campo label="CPF" type="text" value={novo.cpf}
                onChange={e => setNovo(n => ({ ...n, cpf: e.target.value }))}
                placeholder="Somente números" erro={errosNovo.cpf} />
              <Campo label="Nome completo" type="text" value={novo.nome}
                onChange={e => setNovo(n => ({ ...n, nome: e.target.value }))}
                erro={errosNovo.nome} />
              <Campo label="Email" type="email" value={novo.email}
                onChange={e => setNovo(n => ({ ...n, email: e.target.value }))}
                erro={errosNovo.email} />
              <div>
                <label style={{ fontSize:'0.75rem', color:'var(--texto-2)',
                  letterSpacing:'0.06em', textTransform:'uppercase',
                  fontWeight:600, display:'block', marginBottom:8 }}>Perfil</label>
                <div style={{ display:'flex', gap:8 }}>
                  {Object.entries(PERFIS).map(([id, nome]) => (
                    <button key={id}
                      onClick={() => setNovo(n => ({ ...n, perfil_id: parseInt(id, 10) }))}
                      style={{
                        flex:1, padding:'10px 4px', borderRadius:10,
                        border:`2px solid ${
                          novo.perfil_id === parseInt(id, 10)
                            ? 'var(--verde)' : 'var(--borda)'
                        }`,
                        background: novo.perfil_id === parseInt(id, 10)
                          ? 'var(--verde-claro)' : '#fff',
                        color: novo.perfil_id === parseInt(id, 10)
                          ? 'var(--verde)' : 'var(--texto-2)',
                        fontFamily:'var(--fonte-corpo)', fontSize:'0.75rem',
                        fontWeight: novo.perfil_id === parseInt(id, 10) ? 700 : 400,
                        cursor:'pointer',
                      }}>
                      {nome}
                    </button>
                  ))}
                </div>
              </div>
              <Botao variante="verde" onClick={adicionarServidor} carregando={salvando}>
                Cadastrar
              </Botao>
            </div>
          </div>
        )}

        {/* IMPORTAR */}
        {aba === 'csv' && (
          <ImportarCSV
            db={db}
            onSucesso={() => { carregar(); setSucesso('Importação concluída.') }}
          />
        )}
      </div>
    </div>
  )
}

function ImportarCSV({ db, onSucesso }) {
  const [texto, setTexto]           = useState('')
  const [preview, setPreview]       = useState([])
  const [importando, setImportando] = useState(false)
  const [log, setLog]               = useState([])

  const PERFIS_MAP = { 'SERVIDOR':1, 'SUPERVISOR':2, 'ADMINISTRADOR':3 }

  function parsear() {
    const linhas = texto.trim().split('\n').filter(l => l.trim())
    setPreview(linhas.map((linha, i) => {
      const cols = linha.split(/\t|;/).map(c => c.trim())
      const [matricula='', cpf='', nome='', email='', perfil=''] = cols
      const errs = []
      if (!matricula)                        errs.push('matrícula ausente')
      if (cpf.replace(/\D/g,'').length < 10) errs.push('CPF inválido')
      if (!nome)                             errs.push('nome ausente')
      if (!PERFIS_MAP[perfil.toUpperCase()]) errs.push('perfil inválido')
      return {
        matricula,
        cpf: cpf.replace(/\D/g,'').padStart(11,'0'),
        nome: nome.toUpperCase(), email,
        perfil_id: PERFIS_MAP[perfil.toUpperCase()] ?? 1,
        valido: errs.length === 0, errs, linha: i + 1,
      }
    }))
  }

  async function importar() {
    const validos = preview.filter(p => p.valido)
    if (!validos.length) return
    setImportando(true)
    const newLog = []
    let ok = 0, fail = 0
    for (const s of validos) {
      try {
        const { error } = await db.from('servidores').upsert({
          matricula: s.matricula, cpf: s.cpf, nome: s.nome,
          email: s.email || `sem.email.${s.matricula}@ciopaer.local`,
          perfil_id: s.perfil_id, ativo: true,
        }, { onConflict: 'matricula' })
        if (error) throw error
        newLog.push({ msg: `✓ ${s.nome}`, tipo: 'ok' }); ok++
      } catch (e) {
        newLog.push({ msg: `✗ ${s.nome}: ${e.message?.slice(0,60)}`, tipo: 'erro' }); fail++
      }
    }
    newLog.push({ msg: `─ ${ok} importados, ${fail} erros`, tipo: 'info' })
    setLog(newLog); setImportando(false)
    if (ok > 0) onSucesso()
  }

  const card2 = {
    background:'#fff', border:'1.5px solid var(--borda)',
    borderRadius:'var(--raio-lg)', padding:'18px',
    marginBottom:14, boxShadow:'var(--sombra)',
  }

  return (
    <div>
      <div style={card2}>
        <p style={{ color:'var(--texto-2)', fontSize:'0.82rem', marginBottom:12, lineHeight:1.7 }}>
          Cole os dados sem cabeçalho. Colunas por <strong>tab</strong> ou <strong>ponto e vírgula</strong>:<br/>
          <code style={{ fontSize:'0.75rem', color:'var(--verde)' }}>
            matricula · cpf · nome · email · perfil
          </code>
        </p>
        <textarea value={texto} onChange={e => setTexto(e.target.value)}
          placeholder={'12345\t00000000000\tFULANO\temail@pm.ce.gov.br\tSERVIDOR'}
          style={{ width:'100%', minHeight:120, border:'1.5px solid var(--borda)',
            borderRadius:10, padding:12, fontFamily:'monospace', fontSize:'0.78rem',
            color:'var(--texto)', background:'var(--bg)', resize:'vertical' }} />
        <div style={{ display:'flex', gap:10, marginTop:12 }}>
          <Botao variante="secundario" onClick={parsear}>Validar</Botao>
          {preview.filter(p => p.valido).length > 0 && (
            <Botao variante="verde" onClick={importar} carregando={importando}>
              Importar {preview.filter(p => p.valido).length} válidos
            </Botao>
          )}
        </div>
      </div>

      {preview.length > 0 && (
        <div style={card2}>
          <p style={{ color:'var(--texto-2)', fontSize:'0.8rem', marginBottom:10 }}>
            {preview.filter(p=>p.valido).length} válidos ·{' '}
            {preview.filter(p=>!p.valido).length} com erro
          </p>
          <div style={{ maxHeight:260, overflowY:'auto' }}>
            {preview.map((p, i) => (
              <div key={i} style={{ padding:'7px 0', borderBottom:'1px solid var(--borda)',
                display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <span style={{ fontWeight:500, color:'var(--texto)', fontSize:'0.82rem' }}>
                    {p.nome || `Linha ${p.linha}`}
                  </span>
                  {p.errs.length > 0 && (
                    <p style={{ color:'var(--vermelho)', fontSize:'0.72rem', marginTop:2 }}>
                      {p.errs.join(', ')}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize:'0.72rem', padding:'2px 8px', borderRadius:10, marginLeft:8,
                  background: p.valido ? 'var(--verde-claro)' : '#fdf2f2',
                  color: p.valido ? 'var(--verde)' : 'var(--vermelho)',
                  border:`1px solid ${p.valido ? 'var(--verde)' : 'var(--vermelho)'}40`,
                }}>
                  {p.valido ? '✓' : '✗'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {log.length > 0 && (
        <div style={{ ...card2, fontFamily:'monospace', fontSize:'0.75rem',
          maxHeight:180, overflowY:'auto', lineHeight:1.8 }}>
          {log.map((l, i) => (
            <div key={i} style={{ color: l.tipo==='ok' ? 'var(--verde)' :
              l.tipo==='erro' ? 'var(--vermelho)' : 'var(--texto-3)' }}>
              {l.msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
