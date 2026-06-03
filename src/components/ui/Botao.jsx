export function Botao({ children, variante = 'primario', tipo = 'button', onClick, desabilitado, carregando }) {
  const base = {
    padding: '13px 24px', borderRadius: 'var(--raio)',
    fontSize: '0.92rem', fontFamily: 'var(--fonte-corpo)',
    fontWeight: 600, letterSpacing: '0.01em',
    transition: 'opacity 0.15s, transform 0.1s, box-shadow 0.15s',
    width: '100%', cursor: (desabilitado || carregando) ? 'not-allowed' : 'pointer',
    opacity: (desabilitado || carregando) ? 0.5 : 1,
  }
  const variantes = {
    primario:   { background: 'var(--laranja)', color: '#fff',
                  boxShadow: '0 2px 8px rgba(232,98,10,0.3)' },
    secundario: { background: 'var(--surface)', color: 'var(--verde)',
                  border: '1.5px solid var(--borda)' },
    verde:      { background: 'var(--verde)', color: '#fff',
                  boxShadow: '0 2px 8px rgba(0,128,61,0.25)' },
    perigo:     { background: 'var(--vermelho)', color: '#fff' },
  }
  return (
    <button type={tipo} onClick={onClick} disabled={desabilitado || carregando}
      style={{ ...base, ...variantes[variante] }}>
      {carregando ? 'Aguarde...' : children}
    </button>
  )
}
