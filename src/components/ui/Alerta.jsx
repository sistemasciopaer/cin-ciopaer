export function Alerta({ tipo = 'erro', children }) {
  const temas = {
    erro:    { bg: '#FDF2F2', borda: '#E74C3C', texto: '#C0392B' },
    sucesso: { bg: '#F0FAF5', borda: '#00803D', texto: '#006830' },
    info:    { bg: '#F0F7FF', borda: '#2980B9', texto: '#1A5E8A' },
    aviso:   { bg: '#FFF8EC', borda: '#E67E22', texto: '#B7610A' },
  }
  const t = temas[tipo] ?? temas.info
  return (
    <div style={{ background: t.bg, border: `1.5px solid ${t.borda}`,
      borderRadius: 'var(--raio)', padding: '12px 16px',
      color: t.texto, fontSize: '0.88rem', lineHeight: 1.6 }}>
      {children}
    </div>
  )
}
