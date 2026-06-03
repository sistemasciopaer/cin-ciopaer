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
import { GerenciarUsuarios }  from '@/modules/admin/GerenciarUsuarios'
import '@/styles/global.css'

function Placeholder({ nome, voltar = 'dashboard' }) {
  const { setPagina } = useStore()
  return (
    <div style={{ padding:'40px 20px', maxWidth:480, margin:'0 auto' }}>
      <button onClick={() => setPagina(voltar)} style={{
        background:'none', border:'none', color:'var(--verde)',
        cursor:'pointer', marginBottom:24, fontSize:'0.9rem' }}>
        ← Voltar
      </button>
      <h2 style={{ fontFamily:'var(--fonte-titulo)', color:'var(--texto)',
        fontSize:'1.3rem' }}>{nome}</h2>
      <p style={{ color:'var(--texto-3)', marginTop:12, fontSize:'0.9rem' }}>Em construção.</p>
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
    'presenca':            <ConfirmarPresenca />,
    'relatorios':          <Relatorios />,
    'admin':               <Admin />,
    'processar-emails':    <ProcessarEmails />,
    'gerenciar-users':     <GerenciarUsuarios />,
    'slots-extra':         <Placeholder nome="Slots Extras" voltar="admin" />,
  }

  return rotas[pagina] ?? <LoginPage />
}

export default function App() {
  return <Roteador />
}
