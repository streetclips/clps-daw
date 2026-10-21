const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return Array.from(bytes, (byte) => ALPHABET.charAt(byte % ALPHABET.length)).join('')
}
