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

      const { token, expiraEm } = await criarSessao(servidor.id)
      const sessao = {
        token, expiraEm,
        servidorId: servidor.id,
        nome:       servidor.nome,
        email:      servidor.email,
        perfilId:   servidor.perfil_id,
      }
      setSessao(sessao)
      await registrarAuditoria(token, { operacao: 'LOGIN', objeto: 'SERVIDOR', objetoId: servidor.id })
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
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'linear-gradient(160deg, #002b18 0%, #004d2c 50%, #00622f 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Fundo decorativo */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          radial-gradient(ellipse 60% 50% at 80% 20%, rgba(0,128,61,0.25) 0%, transparent 70%),
          radial-gradient(ellipse 40% 40% at 10% 80%, rgba(0,80,40,0.3) 0%, transparent 70%)
        `
      }}/>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px'
      }}/>

      {/* Card */}
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: '40px 36px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Brasão */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img
            src={BRASAO}
            alt="Brasão CIOPAER"
            style={{
              height: 90,
              width: 'auto',
              objectFit: 'contain',
              filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))',
              marginBottom: 16,
            }}
            onError={e => { e.target.style.display = 'none' }}
          />
          <h1 style={{
            fontFamily: 'var(--fonte-titulo)',
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '0.12em',
            marginBottom: 6,
          }}>
            CIOPAER
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: '0.82rem',
            letterSpacing: '0.03em',
          }}>
            Agendamento para emissão da CIN
          </p>

          {/* Linha decorativa */}
          <div style={{
            width: 48, height: 2,
            background: '#00803D',
            margin: '18px auto 0',
            borderRadius: 2,
          }}/>
        </div>

        {/* Formulário */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Campo
            label="Matrícula"
            type="text"
            value={matricula}
            onChange={e => setMatricula(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Sua matrícula"
            autoComplete="off"
            autoFocus
          />
          <Campo
            label="CPF"
            type="text"
            value={cpf}
            onChange={e => setCpf(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="Somente números"
            maxLength={14}
            autoComplete="off"
          />

          {erro && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Alerta tipo="erro">{erro}</Alerta>
              <a href={linkWA} target="_blank" rel="noreferrer">
                <Botao variante="secundario">
                  Falar com o Administrador (WhatsApp)
                </Botao>
              </a>
            </div>
          )}

          <div style={{ marginTop: 4 }}>
            <Botao
              onClick={handleLogin}
              carregando={carregando}
              desabilitado={!matricula || !cpf}
            >
              Entrar
            </Botao>
          </div>
        </div>
      </div>
    </div>
  )
}
