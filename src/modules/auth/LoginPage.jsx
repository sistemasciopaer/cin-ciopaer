import { useState } from 'react'
import { useStore } from '@/lib/store'
import { validarCPF } from '@/lib/cpf'
import { buscarServidor } from './authRepository'
import { criarSessao } from '@/modules/session/sessionRepository'
import { registrarAuditoria } from '@/modules/audit/auditRepository'
import { Campo } from '@/components/ui/Campo'
import { Botao } from '@/components/ui/Botao'
import { Alerta } from '@/components/ui/Alerta'

const WHATSAPP = '5585984390359'
const BRASAO   = 'https://blogger.googleusercontent.com/img/a/AVvXsEj0RgZz8nDwXYQitwlZk0ra9PHwj6bc7SYmAhRMH3-kRox-iLeLXVbU35J5Bg-iQhue8QE4L3liniar8pXig3mTQ-ZwsJIqZdh84GjDOASzsG4VMthRMN6V2uicq452NyVEUS85LFEN8yUeWZxT4fYIU05dIs0Sw_uu5ilMhMvDfipiu1B6jBRfNSVhFQk=s1600'

export function LoginPage() {
  const { setSessao, setPagina } = useStore()
  const [matricula, setMatricula] = useState('')
  const [cpf, setCpf]             = useState('')
  const [erro, setErro]           = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleLogin() {
    setErro('')
    if (!matricula.trim()) { setErro('Informe a matrícula.'); return }
    if (!validarCPF(cpf))  { setErro('CPF inválido.'); return }

    setCarregando(true)
    try {
      const { data: servidor, error } = await buscarServidor(matricula, cpf)
      if (error || !servidor) { setErro('Matrícula ou CPF incorretos.'); return }

      const perfilId = servidor.perfil_id
      // Supervisor/Admin = 8h, Servidor = 30min
      const timeoutMin = perfilId >= 2 ? 480 : 30
      const { token, expiraEm } = await criarSessao(servidor.id, timeoutMin)

      setSessao({
        token, expiraEm, perfilId,
        servidorId: servidor.id,
        nome:       servidor.nome,
        email:      servidor.email,
      })
      await registrarAuditoria(token, {
        operacao: 'LOGIN', objeto: 'SERVIDOR', objetoId: servidor.id
      })
      setPagina('dashboard')
    } catch {
      setErro('Erro ao conectar. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }

  const linkWA = `https://wa.me/${WHATSAPP}?text=Preciso%20de%20acesso%20ao%20sistema%20CIN%20CIOPAER`

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px',
      background: 'linear-gradient(160deg, #e8f5ee 0%, #f2f4f3 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: '40px 32px',
          boxShadow: '0 8px 40px rgba(0,104,48,0.12)',
          border: '1px solid rgba(0,128,61,0.1)',
        }}>
          {/* Brasão */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <img src={BRASAO} alt="CIOPAER"
              style={{ height: 80, width: 'auto', objectFit: 'contain',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))', marginBottom: 14 }}
              onError={e => { e.target.style.display = 'none' }} />
            <h1 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.6rem',
              fontWeight: 700, color: 'var(--verde)', letterSpacing: '0.08em', marginBottom: 4 }}>
              CIOPAER
            </h1>
            <p style={{ color: 'var(--texto-2)', fontSize: '0.82rem' }}>
              Agendamento para emissão da CIN
            </p>
            <div style={{ width: 40, height: 3, background: 'var(--laranja)',
              borderRadius: 2, margin: '14px auto 0' }}/>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Campo label="Matrícula" type="text" value={matricula}
              onChange={e => setMatricula(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Sua matrícula" autoComplete="off" autoFocus />
            <Campo label="CPF" type="text" value={cpf}
              onChange={e => setCpf(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Somente números" maxLength={14} autoComplete="off" />

            {erro && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Alerta tipo="erro">{erro}</Alerta>
                <a href={linkWA} target="_blank" rel="noreferrer">
                  <Botao variante="secundario">Falar com o Administrador (WhatsApp)</Botao>
                </a>
              </div>
            )}

            <div style={{ marginTop: 4 }}>
              <Botao onClick={handleLogin} carregando={carregando}
                desabilitado={!matricula || !cpf}>
                Entrar
              </Botao>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

