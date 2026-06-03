export function Campo({ label, erro, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontSize: '0.75rem', color: 'var(--texto-2)',
          letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
          {label}
        </label>
      )}
      <input {...props} style={{
        background: '#fff',
        border: `1.5px solid ${erro ? 'var(--vermelho)' : 'var(--borda)'}`,
        borderRadius: 'var(--raio)', padding: '12px 14px',
        color: 'var(--texto)', fontSize: '0.95rem', width: '100%',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onFocus={e => {
        e.target.style.borderColor = 'var(--verde)'
        e.target.style.boxShadow   = '0 0 0 3px rgba(0,128,61,0.12)'
      }}
      onBlur={e => {
        e.target.style.borderColor = erro ? 'var(--vermelho)' : 'var(--borda)'
        e.target.style.boxShadow   = 'none'
      }}/>
      {erro && <span style={{ fontSize: '0.78rem', color: 'var(--vermelho)' }}>{erro}</span>}
    </div>
  )
}
