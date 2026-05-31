import { useStore } from '@/lib/store'
import { usePermissao } from '@/hooks/usePermissao'
import { useSessao } from '@/hooks/useSessao'
import { Botao } from '@/components/ui/Botao'

const PERFIS = ['', 'Servidor', 'Supervisor', 'Administrador']

const MENUS = [
  { pagina: 'agendamento',       label: 'Novo Agendamento',   perfil: 1 },
  { pagina: 'meus-agendamentos', label: 'Meus Agendamentos',  perfil: 1 },
  { pagina: 'dependentes',       label: 'Dependentes',        perfil: 1 },
  { pagina: 'presenca',          label: 'Confirmar Presença', perfil: 2 },
  { pagina: 'relatorios',        label: 'Relatórios',         perfil: 2 },
  { pagina: 'admin',             label: 'Administração',      perfil: 3 },
]

export function Dashboard() {
  const { sessao, setPagina } = useStore()
  const { perfilId }          = usePermissao()
  const { logout }            = useSessao()

  return (
    <div style={{ minHeight: '100vh', padding: '40px 24px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 36 }}>
        <p style={{ color: 'var(--cinza-medio)', fontSize: '0.75rem',
          letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
          {PERFIS[perfilId]}
        </p>
        <h2 style={{ fontFamily: 'var(--fonte-titulo)', color: 'var(--dourado)',
          fontSize: '1.5rem', fontWeight: 700 }}>
          Olá, {sessao?.nome?.split(' ')[0]}
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {MENUS.filter(m => perfilId >= m.perfil).map(m => (
          <button key={m.pagina} onClick={() => setPagina(m.pagina)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 'var(--raio-lg)',
              padding: '18px 22px',
              color: 'var(--branco)',
              fontSize: '1rem',
              textAlign: 'left',
              fontFamily: 'var(--fonte-corpo)',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background    = 'rgba(200,169,110,0.08)'
              e.currentTarget.style.borderColor   = 'rgba(200,169,110,0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background    = 'rgba(255,255,255,0.04)'
              e.currentTarget.style.borderColor   = 'rgba(255,255,255,0.09)'
            }}>
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 40 }}>
        <Botao variante="secundario" onClick={logout}>Sair</Botao>
      </div>
    </div>
  )
}
