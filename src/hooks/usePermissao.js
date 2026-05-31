import { useStore } from '@/lib/store'

// 1 = SERVIDOR | 2 = SUPERVISOR | 3 = ADMINISTRADOR
export function usePermissao() {
  const { sessao } = useStore()
  const perfilId = sessao?.perfilId ?? 0
  return {
    ehServidor:      perfilId >= 1,
    ehSupervisor:    perfilId >= 2,
    ehAdministrador: perfilId === 3,
    perfilId
  }
}
