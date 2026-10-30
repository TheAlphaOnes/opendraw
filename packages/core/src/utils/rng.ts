/**
 * Seeded randomness and identity helpers.
 *
 * rough.js takes a numeric seed per shape so hand-drawn jitter stays stable
 * between frames. Element ids and nonces identify elements and last-writer
 * wins for future collaborative use.
 */

const UID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Fast, seedable PRNG (mulberry32), deterministic per seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random positive integer usable as a rough.js seed. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31)
}

function randomBytesFallback(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes)
    return bytes
  }
  // Non-secure fallback for exotic environments.
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

/** Short, url-safe, sortable-enough unique id for element identity. */
export function newId(prefix = ''): string {
  const bytes = randomBytesFallback(16)
  let id = ''
  for (const byte of bytes) {
    id += UID_ALPHABET[byte % UID_ALPHABET.length]
  }
  return prefix ? `${prefix}_${id}` : id
}

/** Fresh nonce marking the latest mutation of an element. */
export function newNonce(): string {
  return newId().slice(0, 8)
}
