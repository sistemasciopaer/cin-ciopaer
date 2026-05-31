export function Campo({ label, erro, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {label}
        </label>
      )}
      <input {...props} style={{
        background: 'rgba(255,255,255,0.07)',
        border: `1px solid ${erro ? 'var(--vermelho)' : 'rgba(255,255,255,0.15)'}`,
        borderRadius: 'var(--raio)',
        padding: '13px 16px',
        color: '#ffffff',
        fontSize: '1rem',
        width: '100%',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => { if (!erro) e.target.style.borderColor = 'rgba(0,128,61,0.7)' }}
      onBlur={e  => { if (!erro) e.target.style.borderColor = 'rgba(255,255,255,0.15)' }}
      />
      {erro && <span style={{ fontSize: '0.78rem', color: 'var(--vermelho)' }}>{erro}</span>}
    </div>
  )
}
