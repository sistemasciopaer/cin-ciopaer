import { useStore } from '@/lib/store'
import { useSessao } from '@/hooks/useSessao'
import { LoginPage } from '@/modules/auth/LoginPage'
import { Dashboard } from '@/modules/auth/Dashboard'
import '@/styles/global.css'

function Placeholder({ nome }) {
  const { setPagina } = useStore()
  return (
    <div style={{ padding: '40px 24px', maxWidth: 480, margin: '0 auto' }}>
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'var(--dourado)',
        cursor: 'pointer', marginBottom: 24, fontSize: '0.9rem' }}>
        ← Voltar
      </button>
      <h2 style={{ fontFamily: 'var(--fonte-titulo)', color: 'var(--dourado)',
        fontSize: '1.3rem' }}>{nome}</h2>
      <p style={{ color: 'var(--cinza-medio)', marginTop: 12, fontSize: '0.9rem' }}>
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
    'agendamento':         <Placeholder nome="Novo Agendamento" />,
    'meus-agendamentos':   <Placeholder nome="Meus Agendamentos" />,
    'dependentes':         <Placeholder nome="Dependentes" />,
    'presenca':            <Placeholder nome="Confirmar Presença" />,
    'relatorios':          <Placeholder nome="Relatórios" />,
    'admin':               <Placeholder nome="Administração" />,
  }

  return rotas[pagina] ?? <LoginPage />
}

export default function App() {
  return <Roteador />
}
