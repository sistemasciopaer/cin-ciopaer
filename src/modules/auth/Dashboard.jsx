import { useStore } from '@/lib/store'
import { usePermissao } from '@/hooks/usePermissao'
import { useSessao } from '@/hooks/useSessao'
import { Botao } from '@/components/ui/Botao'

const BRASAO = 'https://blogger.googleusercontent.com/img/a/AVvXsEj0RgZz8nDwXYQitwlZk0ra9PHwj6bc7SYmAhRMH3-kRox-iLeLXVbU35J5Bg-iQhue8QE4L3liniar8pXig3mTQ-ZwsJIqZdh84GjDOASzsG4VMthRMN6V2uicq452NyVEUS85LFEN8yUeWZxT4fYIU05dIs0Sw_uu5ilMhMvDfipiu1B6jBRfNSVhFQk=s1600'

const PERFIS = ['', 'Servidor', 'Supervisor', 'Administrador']

const MENUS = [
  { pagina: 'agendamento',       label: 'Novo Agendamento',   icon: '📅', perfil: 1, cor: 'var(--verde)' },
  { pagina: 'meus-agendamentos', label: 'Meus Agendamentos',  icon: '📋', perfil: 1, cor: 'var(--verde)' },
  { pagina: 'presenca',          label: 'Confirmar Presença', icon: '✓',  perfil: 2, cor: 'var(--laranja)' },
  { pagina: 'relatorios',        label: 'Relatórios',         icon: '📊', perfil: 2, cor: 'var(--verde)' },
  { pagina: 'admin',             label: 'Administração',      icon: '⚙️', perfil: 3, cor: 'var(--texto-2)' },
]

export function Dashboard() {
  const { sessao, setPagina } = useStore()
  const { perfilId }          = usePermissao()
  const { logout }            = useSessao()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>

      {/* Header */}
      <div style={{
        background: 'var(--verde)', padding: '28px 24px 40px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', right: -20, top: -20, opacity: 0.08 }}>
          <img src={BRASAO} alt="" style={{ height: 160 }}
            onError={e => e.target.style.display = 'none'} />
        </div>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.72rem',
          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          {PERFIS[perfilId]}
        </p>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', color: '#fff',
          fontSize: '1.5rem', fontWeight: 700, marginBottom: 2 }}>
          Olá, {sessao?.nome?.split(' ')[0]} 👋
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
          Sistema de Agendamento CIN
        </p>
      </div>

      {/* Cards de menu */}
      <div style={{ padding: '0 16px', marginTop: -20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {MENUS.filter(m => perfilId >= m.perfil).map(m => (
            <button key={m.pagina} onClick={() => setPagina(m.pagina)}
              style={{
                background: '#fff', border: '1.5px solid var(--borda)',
                borderRadius: 'var(--raio-lg)', padding: '16px 20px',
                textAlign: 'left', cursor: 'pointer',
                boxShadow: 'var(--sombra)',
                transition: 'transform 0.12s, box-shadow 0.12s, border-color 0.12s',
                display: 'flex', alignItems: 'center', gap: 16,
                fontFamily: 'var(--fonte-corpo)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform    = 'translateY(-1px)'
                e.currentTarget.style.boxShadow    = 'var(--sombra-lg)'
                e.currentTarget.style.borderColor  = m.cor
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform    = 'none'
                e.currentTarget.style.boxShadow    = 'var(--sombra)'
                e.currentTarget.style.borderColor  = 'var(--borda)'
              }}>
              <div style={{ width: 44, height: 44, borderRadius: 12,
                background: m.cor === 'var(--laranja)' ? 'var(--laranja-claro)' : 'var(--verde-claro)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem', flexShrink: 0 }}>
                {m.icon}
              </div>
              <div>
                <p style={{ color: 'var(--texto)', fontWeight: 600, fontSize: '0.95rem' }}>
                  {m.label}
                </p>
              </div>
              <span style={{ marginLeft: 'auto', color: 'var(--texto-3)', fontSize: '1rem' }}>›</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <Botao variante="secundario" onClick={logout}>Sair</Botao>
        </div>
      </div>
    </div>
  )
}
