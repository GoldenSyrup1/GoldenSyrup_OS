// Single-user session auth.
//
// Once this server is reachable from the internet it is holding an Anthropic
// API key, so an unauthenticated /architect is someone else's free model access
// billed to Sriram. The browser cannot hold the secret — anything shipped to it
// is public, which is exactly why the key lives here — so the browser proves
// itself with a password once and carries an httpOnly cookie afterwards.
//
// No JWT library: an HMAC over "expiry" is the whole requirement, and a
// dependency that parses attacker-controlled tokens is a bigger surface than
// the twelve lines it replaces.
//
// Free of express and of node:fs so the root Vitest suite can unit-test it.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const SESSION_COOKIE = 'gsos_session'

/** How long a login lasts. Long, because it is one person on their own laptop. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Compare two strings without leaking their contents through timing. */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // length — so hash both to a fixed width first.
  const hashA = createHmac('sha256', 'compare').update(bufA).digest()
  const hashB = createHmac('sha256', 'compare').update(bufB).digest()
  return timingSafeEqual(hashA, hashB)
}

/** Mint a signed session token that expires at `expiresAt`. */
export function signToken(secret, expiresAt) {
  const payload = String(expiresAt)
  const sig = createHmac('sha256', secret).update(payload).digest('hex')
  return `${payload}.${sig}`
}

/**
 * Verify a token. Returns true only for a well-formed, correctly signed,
 * unexpired token — a bad shape is rejected before any crypto runs.
 */
export function verifyToken(secret, token, now) {
  if (typeof token !== 'string') return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expiresAt = Number(payload)
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return sig.length === expected.length && safeEqual(sig, expected)
}

/** Parse a Cookie header into a plain object. Tolerates junk. */
export function parseCookies(header) {
  const out = {}
  if (typeof header !== 'string') return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      out[key] = part.slice(eq + 1).trim()
    }
  }
  return out
}

/** Serialise a Set-Cookie value. `secure` should track whether we're on https. */
export function serializeCookie(name, value, { maxAgeMs, secure }) {
  const bits = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ]
  if (secure) bits.push('Secure')
  return bits.join('; ')
}

/** A session secret: the configured one, or a random per-boot one. */
export function resolveSessionSecret(configured) {
  // A random secret means restarting logs Sriram out, which is a fair trade
  // against a predictable default that would let anyone forge a cookie.
  return configured && configured.length >= 16 ? configured : randomBytes(32).toString('hex')
}
