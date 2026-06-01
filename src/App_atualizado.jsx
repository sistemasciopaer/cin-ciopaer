import { useStore } from '@/lib/store'
import { useSessao } from '@/hooks/useSessao'
import { LoginPage }          from '@/modules/auth/LoginPage'
import { Dashboard }          from '@/modules/auth/Dashboard'
import { NovoAgendamento }    from '@/modules/scheduling/NovoAgendamento'
import { MeusAgendamentos }   from '@/modules/scheduling/MeusAgendamentos'
import { ConfirmarPresenca }  from '@/modules/attendance/ConfirmarPresenca'
import { Relatorios }         from '@/modules/reports/Relatorios'
import { Admin }              from '@/modules/admin/Admin'
import { ProcessarEmails }    from '@/modules/queue/ProcessarEmails'
import '@/styles/global.css'

function Placeholder({ nome }) {
  const { setPagina } = useStore()
  return (
    <div style={{ padding: '40px 24px', maxWidth: 480, margin: '0 auto' }}>
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'var(--verde-base)',
        cursor: 'pointer', marginBottom: 24, fontSize: '0.9rem' }}>
        ← Voltar
      </button>
      <h2 style={{ fontFamily: 'var(--fonte-titulo)', color: '#fff', fontSize: '1.3rem' }}>{nome}</h2>
      <p style={{ color: 'rgba(255,255,255,0.35)', marginTop: 12, fontSize: '0.9rem' }}>
        Módulo em construção.
      </p>
    </div>
  )
}

function Roteador() {
  const { pagina } = useStore()
  const { sessao } = useSessao()

  if (!sessao && pagina !== 'login') return <LoginPage />

  const rotas = {
    'login':               <LoginPage />,
    'dashboard':           <Dashboard />,
    'agendamento':         <NovoAgendamento />,
    'meus-agendamentos':   <MeusAgendamentos />,
    'confirmar-presenca':  <ConfirmarPresenca />,
    'relatorios':          <Relatorios />,
    'admin':               <Admin />,
    'processar-emails':    <ProcessarEmails />,
    'dependentes':         <Placeholder nome="Dependentes" />,
    'slots-extra':         <Placeholder nome="Slots Extras" />,
    'gerenciar-users':     <Placeholder nome="Gerenciar Usuários" />,
    'presenca':            <ConfirmarPresenca />,
  }

  return rotas[pagina] ?? <LoginPage />
}

export default function App() {
  return <Roteador />
}
