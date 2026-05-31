export function Botao({ children, variante = 'primario', tipo = 'button', onClick, desabilitado, carregando }) {
  const base = {
    padding: '12px 24px',
    borderRadius: 'var(--raio)',
    fontSize: '0.95rem',
    fontFamily: 'var(--fonte-corpo)',
    letterSpacing: '0.02em',
    transition: 'opacity 0.15s, transform 0.1s',
    width: '100%',
    cursor: (desabilitado || carregando) ? 'not-allowed' : 'pointer',
    opacity: (desabilitado || carregando) ? 0.5 : 1,
  }
  const variantes = {
    primario:   { background: 'var(--dourado)',  color: 'var(--azul-escuro)', fontWeight: 600 },
    secundario: { background: 'transparent',     color: 'var(--dourado)',     border: '1px solid var(--dourado)' },
    perigo:     { background: 'var(--vermelho)', color: 'var(--branco)',      fontWeight: 600 },
  }
  return (
    <button type={tipo} onClick={onClick} disabled={desabilitado || carregando}
      style={{ ...base, ...variantes[variante] }}>
      {carregando ? 'Aguarde...' : children}
    </button>
  )
}
