export function traduzirErro(error) {
  if (!error) return 'Erro desconhecido.'
  const msg = error.message || ''
  if (msg.includes('cpf_ativo'))             return 'Este CPF já possui um agendamento ativo.'
  if (msg.includes('servidor_proprio_ativo')) return 'Você já possui um agendamento ativo.'
  if (msg.includes('chk_ocupacao'))          return 'Este horário não possui mais vagas disponíveis.'
  if (msg.includes('sessao'))               return 'Sessão expirada. Faça login novamente.'
  if (msg.includes('ciente_documentacao'))  return 'É obrigatório confirmar a ciência da documentação.'
  return 'Ocorreu um erro. Tente novamente.'
}
