import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { invalidarSessao } from '@/modules/session/sessionRepository'

const TIMEOUT_MS = 30 * 60 * 1000

export function useSessao() {
  const { sessao, clearSessao, setPagina } = useStore()
  const timerRef = useRef(null)

  const logout = async () => {
    if (sessao?.token) await invalidarSessao(sessao.token)
    clearSessao()
    setPagina('login')
  }

  const resetarTimer = () => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(logout, TIMEOUT_MS)
  }

  useEffect(() => {
    if (!sessao) return
    resetarTimer()
    const eventos = ['mousemove', 'keydown', 'touchstart', 'click']
    eventos.forEach(e => window.addEventListener(e, resetarTimer))
    return () => {
      clearTimeout(timerRef.current)
      eventos.forEach(e => window.removeEventListener(e, resetarTimer))
    }
  }, [sessao])

  return { sessao, logout }
}
