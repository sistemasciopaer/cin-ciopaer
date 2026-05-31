import { create } from 'zustand'

export const useStore = create((set) => ({
  // Sessão ativa
  sessao: null,  // { token, servidorId, nome, email, perfilId, expiraEm }
  setSessao:   (s) => set({ sessao: s }),
  clearSessao: ()  => set({ sessao: null }),

  // Navegação SPA
  pagina: 'login',
  setPagina: (p) => set({ pagina: p }),
}))
