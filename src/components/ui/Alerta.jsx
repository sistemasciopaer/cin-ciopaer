export function Alerta({ tipo = 'erro', children }) {
  const temas = {
    erro:    { bg: 'rgba(192,57,43,0.15)',  borda: 'var(--vermelho)',   texto: '#ff6b5b' },
    sucesso: { bg: 'rgba(39,128,90,0.15)',  borda: 'var(--verde)',      texto: '#5bffa8' },
    info:    { bg: 'rgba(37,99,168,0.15)',  borda: 'var(--azul-claro)', texto: '#7db8f7' },
  }
  const t = temas[tipo] ?? temas.info
  return (
    <div style={{ background: t.bg, border: `1px solid ${t.borda}`,
      borderRadius: 'var(--raio)', padding: '12px 16px',
      color: t.texto, fontSize: '0.9rem', lineHeight: 1.5 }}>
      {children}
    </div>
  )
}
