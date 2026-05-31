export function Campo({ label, erro, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: '0.78rem', color: 'var(--cinza-claro)',
          letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </label>
      )}
      <input {...props} style={{
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${erro ? 'var(--vermelho)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 'var(--raio)',
        padding: '12px 16px',
        color: 'var(--branco)',
        fontSize: '1rem',
        width: '100%',
        transition: 'border-color 0.15s',
      }} />
      {erro && <span style={{ fontSize: '0.8rem', color: 'var(--vermelho)' }}>{erro}</span>}
    </div>
  )
}
