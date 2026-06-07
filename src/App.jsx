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
import { SlotsExtra }         from '@/modules/admin/SlotsExtra'
import '@/styles/global.css'

export default function App() {
  const { pagina } = useStore()
  const { sessao } = useSessao()

  if (!sessao && pagina !== 'login') return <LoginPage />

  const rotas = {
    'login':              <LoginPage />,
    'dashboard':          <Dashboard />,
    'agendamento':        <NovoAgendamento />,
    'meus-agendamentos':  <MeusAgendamentos />,
    'presenca':           <ConfirmarPresenca />,
    'relatorios':         <Relatorios />,
    'admin':              <Admin />,
    'processar-emails':   <ProcessarEmails />,
    'gerenciar-users':    <GerenciarUsuarios />,
    'slots-extra':        <SlotsExtra />,
  }

  return rotas[pagina] ?? <LoginPage />
}
