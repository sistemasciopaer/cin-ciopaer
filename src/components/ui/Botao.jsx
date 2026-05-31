export function Botao({ children, variante = 'primario', tipo = 'button', onClick, desabilitado, carregando }) {
  const base = {
    padding: '13px 24px',
    borderRadius: 'var(--raio)',
    fontSize: '0.95rem',
    fontFamily: 'var(--fonte-corpo)',
    fontWeight: 500,
    letterSpacing: '0.02em',
    transition: 'opacity 0.15s, transform 0.1s',
    width: '100%',
    cursor: (desabilitado || carregando) ? 'not-allowed' : 'pointer',
    opacity: (desabilitado || carregando) ? 0.45 : 1,
  }
  const variantes = {
    primario:   { background: 'var(--verde-base)', color: '#ffffff', fontWeight: 600 },
    secundario: { background: 'transparent',       color: 'rgba(255,255,255,0.75)', border: '1px solid rgba(255,255,255,0.25)' },
    perigo:     { background: 'var(--vermelho)',    color: '#ffffff', fontWeight: 600 },
  }
  return (
    <button type={tipo} onClick={onClick} disabled={desabilitado || carregando}
      style={{ ...base, ...variantes[variante] }}>
      {carregando ? 'Aguarde...' : children}
    </button>
  )
}
