// Remove máscara — retorna somente dígitos
export function normalizarCPF(cpf) {
  return String(cpf).replace(/\D/g, '')
}

// Formata para exibição: 000.000.000-00
export function formatarCPF(cpf) {
  const d = normalizarCPF(cpf)
  if (d.length !== 11) return cpf
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

// Valida dígitos verificadores
export function validarCPF(cpf) {
  const d = normalizarCPF(cpf)
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  const calc = (len) => {
    let s = 0
    for (let i = 0; i < len; i++) s += parseInt(d[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r >= 10 ? 0 : r
  }
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10])
}
