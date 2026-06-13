// Reexporta tudo de lib/sessao para manter compatibilidade
export {
  criarSessao,
  validarSessao,
  restaurarSessao,
  invalidarSessao,
  salvarTokenLocal,
  obterTokenLocal,
  removerTokenLocal,
} from '@/lib/sessao'
