import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import { invalidarSessao } from '@/modules/session/sessionRepository'

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
    if (!sessao?.expiraEm) return
    const restante = new Date(sessao.expiraEm).getTime() - Date.now()
    if (restante <= 0) { logout(); return }
    timerRef.current = setTimeout(logout, restante)
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
