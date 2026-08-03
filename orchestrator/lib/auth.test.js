import { describe, expect, it } from 'vitest'
import {
  SESSION_TTL_MS,
  parseCookies,
  resolveSessionSecret,
  safeEqual,
  serializeCookie,
  signToken,
  verifyToken,
} from './auth.js'

const SECRET = 'a'.repeat(32)
const NOW = 1_700_000_000_000

describe('safeEqual', () => {
  it('matches equal strings and rejects different ones', () => {
    expect(safeEqual('hunter2', 'hunter2')).toBe(true)
    expect(safeEqual('hunter2', 'hunter3')).toBe(false)
  })

  // timingSafeEqual throws on a length mismatch, which would leak the length.
  it('handles different lengths without throwing', () => {
    expect(safeEqual('short', 'considerably longer')).toBe(false)
    expect(safeEqual('', 'x')).toBe(false)
  })
})

describe('signToken / verifyToken', () => {
  it('accepts a token it just minted', () => {
    const token = signToken(SECRET, NOW + SESSION_TTL_MS)
    expect(verifyToken(SECRET, token, NOW)).toBe(true)
  })

  it('rejects an expired token', () => {
    const token = signToken(SECRET, NOW - 1)
    expect(verifyToken(SECRET, token, NOW)).toBe(false)
  })

  it('rejects a token signed with another secret', () => {
    const token = signToken('b'.repeat(32), NOW + SESSION_TTL_MS)
    expect(verifyToken(SECRET, token, NOW)).toBe(false)
  })

  // The whole point: the expiry must not be editable without the secret.
  it('rejects a token whose expiry was extended by hand', () => {
    const token = signToken(SECRET, NOW - 1)
    const forged = `${NOW + SESSION_TTL_MS}.${token.split('.')[1]}`
    expect(verifyToken(SECRET, forged, NOW)).toBe(false)
  })

  it('rejects malformed input without throwing', () => {
    for (const bad of [undefined, null, 42, '', '.', 'nodot', '.sigonly', 'abc.def', {}]) {
      expect(verifyToken(SECRET, bad, NOW)).toBe(false)
    }
  })
})

describe('parseCookies', () => {
  it('parses a normal header', () => {
    expect(parseCookies('gsos_session=abc; other=1')).toEqual({ gsos_session: 'abc', other: '1' })
  })

  it('url-decodes values', () => {
    expect(parseCookies('a=one%20two').a).toBe('one two')
  })

  it('tolerates junk and non-strings', () => {
    expect(parseCookies(undefined)).toEqual({})
    expect(parseCookies('')).toEqual({})
    expect(parseCookies('novalue; =noname; a=1')).toEqual({ a: '1' })
    expect(parseCookies('a=%E0%A4%A')).toEqual({ a: '%E0%A4%A' })
  })
})

describe('serializeCookie', () => {
  it('is httpOnly and same-site by default', () => {
    const c = serializeCookie('gsos_session', 'tok', { maxAgeMs: 1000, secure: false })
    expect(c).toContain('HttpOnly')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Max-Age=1')
    expect(c).not.toContain('Secure')
  })

  it('adds Secure over https', () => {
    expect(serializeCookie('a', 'b', { maxAgeMs: 1000, secure: true })).toContain('Secure')
  })
})

describe('resolveSessionSecret', () => {
  it('uses a configured secret of reasonable length', () => {
    expect(resolveSessionSecret(SECRET)).toBe(SECRET)
  })

  // A predictable fallback would let anyone forge a session cookie.
  it('generates a random one when unset or too short', () => {
    const a = resolveSessionSecret(undefined)
    const b = resolveSessionSecret('tiny')
    expect(a).toHaveLength(64)
    expect(a).not.toBe(b)
  })
})
