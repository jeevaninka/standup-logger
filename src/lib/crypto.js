// AES-GCM client-side encryption for notes.
// Requires VITE_NOTES_KEY to be set in .env (any string, min 8 chars).
// The same key must be used by all team members to decrypt each other's notes.

const ENC_PREFIX = 'enc:v1:'

async function getKey() {
  const raw = import.meta.env.VITE_NOTES_KEY
  if (!raw) throw new Error('VITE_NOTES_KEY is not set')
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(raw), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('standup-logger-notes'), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptNote(plaintext) {
  if (!import.meta.env.VITE_NOTES_KEY) return plaintext // no key → store plaintext
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.byteLength + cipherBuf.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(cipherBuf), iv.byteLength)
  return ENC_PREFIX + btoa(String.fromCharCode(...combined))
}

export async function decryptNote(stored) {
  if (!stored) return stored
  if (!stored.startsWith(ENC_PREFIX)) return stored // not encrypted, return as-is
  if (!import.meta.env.VITE_NOTES_KEY) return '[Note encrypted — set VITE_NOTES_KEY to read]'
  try {
    const key = await getKey()
    const bytes = Uint8Array.from(atob(stored.slice(ENC_PREFIX.length)), c => c.charCodeAt(0))
    const iv = bytes.slice(0, 12)
    const cipher = bytes.slice(12)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return new TextDecoder().decode(plain)
  } catch {
    return '[Could not decrypt note]'
  }
}
