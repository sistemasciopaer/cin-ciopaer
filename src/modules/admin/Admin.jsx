import { useState } from 'react'
import { useStore } from '@/lib/store'
import { Botao } from '@/components/ui/Botao'

const MENUS_ADMIN = [
  { pagina: 'processar-emails', label: 'Fila de Emails',     icon: '📧', desc: 'Processar e monitorar envios' },
  { pagina: 'slots-extra',      label: 'Slots Extras',       icon: '➕', desc: 'Criar horários adicionais' },
  { pagina: 'gerenciar-users',  label: 'Gerenciar Usuários', icon: '👥', desc: 'Alterar perfis dos servidores' },
]

export function Admin() {
  const { setPagina } = useStore()

  return (
    <div style={{ minHeight: '100vh', padding: '32px 20px 60px', maxWidth: 480, margin: '0 auto' }}>
      <button onClick={() => setPagina('dashboard')} style={{
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '0.88rem', marginBottom: 24, padding: 0,
      }}>← Voltar</button>

      <h2 style={{ fontFamily: 'var(--fonte-titulo)', fontSize: '1.4rem',
        fontWeight: 700, color: '#fff', marginBottom: 8 }}>
        Administração
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.82rem', marginBottom: 28 }}>
        Funções exclusivas do administrador
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {MENUS_ADMIN.map(m => (
          <button key={m.pagina} onClick={() => setPagina(m.pagina)}
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '18px 20px', textAlign: 'left', cursor: 'pointer',
              transition: 'border-color 0.15s', width: '100%',
              fontFamily: 'var(--fonte-corpo)',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(0,128,61,0.3)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: '1.4rem' }}>{m.icon}</span>
              <div>
                <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem', marginBottom: 2 }}>
                  {m.label}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>{m.desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
