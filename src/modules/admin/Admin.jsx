import { useStore } from '@/lib/store'
import { Botao } from '@/components/ui/Botao'

const MENUS = [
  { pagina: 'processar-emails', label: 'Fila de Emails',     icon: '📧',
    desc: 'Processar e monitorar envios', cor: 'var(--verde)' },
  { pagina: 'slots-extra',      label: 'Slots Extras',       icon: '➕',
    desc: 'Criar horários adicionais',    cor: 'var(--laranja)' },
  { pagina: 'gerenciar-users',  label: 'Gerenciar Usuários', icon: '👥',
    desc: 'Cadastrar e alterar perfis',   cor: 'var(--verde)' },
]

export function Admin() {
  const { setPagina } = useStore()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      <div style={{ background: 'var(--verde)', padding: '24px 20px 36px' }}>
        <button onClick={() => setPagina('dashboard')} style={{
          background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
          borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem',
          cursor: 'pointer', marginBottom: 16, fontFamily: 'var(--fonte-corpo)',
        }}>← Voltar</button>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.3rem',
          fontWeight: 700, color: '#fff', marginBottom: 4 }}>
          Administração
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem' }}>
          Funções exclusivas do administrador
        </p>
      </div>

      <div style={{ padding: '0 16px', marginTop: -16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MENUS.map(m => (
            <button key={m.pagina} onClick={() => setPagina(m.pagina)}
              style={{
                background: '#fff', border: '1.5px solid var(--borda)',
                borderRadius: 'var(--raio-lg)', padding: '18px 20px',
                textAlign: 'left', cursor: 'pointer', width: '100%',
                boxShadow: 'var(--sombra)',
                transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
                display: 'flex', alignItems: 'center', gap: 16,
                fontFamily: 'var(--fonte-corpo)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform   = 'translateY(-1px)'
                e.currentTarget.style.boxShadow   = 'var(--sombra-lg)'
                e.currentTarget.style.borderColor = m.cor
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform   = 'none'
                e.currentTarget.style.boxShadow   = 'var(--sombra)'
                e.currentTarget.style.borderColor = 'var(--borda)'
              }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                background: m.cor === 'var(--laranja)' ? 'var(--laranja-claro)' : 'var(--verde-claro)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem' }}>
                {m.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--texto)', fontWeight: 600, fontSize: '0.95rem', marginBottom: 2 }}>
                  {m.label}
                </p>
                <p style={{ color: 'var(--texto-3)', fontSize: '0.78rem' }}>{m.desc}</p>
              </div>
              <span style={{ color: 'var(--texto-3)', fontSize: '1rem' }}>›</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

      </div>
    </div>
  )
}
