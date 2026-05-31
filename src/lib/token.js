// Token criptograficamente seguro para sessão (64 hex chars)
export function gerarToken() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('')
}

// Identificador único para QRCode
export function gerarQRCodeId() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return 'QR-' + Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('')
}
