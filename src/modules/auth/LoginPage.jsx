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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 32 }}>

        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--cinza-medio)', fontSize: '0.75rem',
            letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>
            Polícia Militar do Ceará
          </p>
          <h1 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '2rem',
            fontWeight: 700, color: 'var(--dourado)', letterSpacing: '0.06em' }}>
            CIOPAER
          </h1>
          <p style={{ color: 'var(--cinza-claro)', fontSize: '0.9rem', marginTop: 8 }}>
            Agendamento para emissão da CIN
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Campo label="Matrícula" type="text" value={matricula}
            onChange={e => setMatricula(e.target.value)}
            placeholder="Sua matrícula" autoComplete="off" />

          <Campo label="CPF" type="text" value={cpf}
            onChange={e => setCpf(e.target.value)}
            placeholder="000.000.000-00" maxLength={14} autoComplete="off" />

          {erro && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Alerta tipo="erro">{erro}</Alerta>
              <a href={linkWA} target="_blank" rel="noreferrer">
                <Botao variante="secundario">Falar com o Administrador (WhatsApp)</Botao>
              </a>
            </div>
          )}

          <Botao onClick={handleLogin} carregando={carregando}
            desabilitado={!matricula || !cpf}>
            Entrar
          </Botao>
        </div>
      </div>
    </div>
  )
}
