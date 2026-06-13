import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'
import { useSessao } from '@/hooks/useSessao'
import { restaurarSessao } from '@/lib/sessao'
import { supabase } from '@/lib/supabase'
import { LoginPage }         from '@/modules/auth/LoginPage'
import { Dashboard }         from '@/modules/auth/Dashboard'
import { NovoAgendamento }   from '@/modules/scheduling/NovoAgendamento'
import { MeusAgendamentos }  from '@/modules/scheduling/MeusAgendamentos'
import { ConfirmarPresenca } from '@/modules/attendance/ConfirmarPresenca'
import { Relatorios }        from '@/modules/reports/Relatorios'
import { Admin }             from '@/modules/admin/Admin'
import { ProcessarEmails }   from '@/modules/queue/ProcessarEmails'
import { GerenciarUsuarios } from '@/modules/admin/GerenciarUsuarios'
import { SlotsExtra }        from '@/modules/admin/SlotsExtra'
import '@/styles/global.css'

export default function App() {
  const { pagina, sessao, setSessao, setPagina } = useStore()
  const { sessao: sessaoAtiva } = useSessao()
  const [restaurando, setRestaurando] = useState(true)

  // Restaurar sessão ao carregar/recarregar a página
  useEffect(() => {
    async function restaurar() {
      try {
        const dadosSessao = await restaurarSessao()
        if (dadosSessao) {
          // Buscar dados completos do servidor
          const { data: servidor } = await supabase
            .from('servidores')
            .select('id, nome, email, cpf, perfil_id')
            .eq('id', dadosSessao.servidor_id)
            .single()

          if (servidor) {
            setSessao({
              token:      dadosSessao.token,
              expiraEm:   dadosSessao.expira_em,
              servidorId: servidor.id,
              nome:       servidor.nome,
              email:      servidor.email,
              cpf:        servidor.cpf,
              perfilId:   servidor.perfil_id,
            })
            // Só redireciona para dashboard se estiver na tela de login
            if (pagina === 'login') setPagina('dashboard')
          }
        }
      } catch {
        // Sessão inválida — permanece no login
      } finally {
        setRestaurando(false)
      }
    }
    restaurar()
  }, [])

  // Tela de carregamento enquanto verifica sessão
  if (restaurando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%',
            border: '3px solid var(--borda)', borderTopColor: 'var(--verde)',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }}/>
          <p style={{ color: 'var(--texto-3)', fontSize: '0.85rem' }}>Carregando...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!sessaoAtiva && pagina !== 'login') return <LoginPage />

  const rotas = {
    'login':             <LoginPage />,
    'dashboard':         <Dashboard />,
    'agendamento':       <NovoAgendamento />,
    'meus-agendamentos': <MeusAgendamentos />,
    'presenca':          <ConfirmarPresenca />,
    'relatorios':        <Relatorios />,
    'admin':             <Admin />,
    'processar-emails':  <ProcessarEmails />,
    'gerenciar-users':   <GerenciarUsuarios />,
    'slots-extra':       <SlotsExtra />,
  }

  return rotas[pagina] ?? <LoginPage />
}
