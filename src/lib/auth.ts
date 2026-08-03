// Browser half of the single-user session auth.
//
// The password is only ever posted; what the browser keeps afterwards is an
// httpOnly cookie it cannot read, which is the point — a token in JS is a token
// any injected script can take. So there is no "is logged in" flag stored here:
// we ask the server.

import { env } from './env'

export interface AuthStatus {
  /** Whether this deployment demands a password at all. */
  required: boolean
  authed: boolean
}

/** Local-only deployments run with auth off, so assume open when unconfigured. */
const OPEN: AuthStatus = { required: false, authed: true }

export async function fetchAuthStatus(): Promise<AuthStatus> {
  if (!env.orchestratorEnabled) return OPEN
  try {
    const res = await fetch(`${env.orchestratorBase}/auth/status`, { credentials: 'include' })
    if (!res.ok) throw new Error(String(res.status))
    const body = (await res.json()) as Partial<AuthStatus>
    return { required: Boolean(body.required), authed: Boolean(body.authed) }
  } catch {
    // An orchestrator that cannot be reached is not a locked one — the app
    // still works against localStorage, so don't trap Sriram behind a login
    // screen he has no way to satisfy.
    return OPEN
  }
}

/** Exchange a password for a session cookie. Throws with the server's message. */
export async function login(password: string): Promise<void> {
  const res = await fetch(`${env.orchestratorBase}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Sign-in failed (${res.status}).`)
  }
}

export async function logout(): Promise<void> {
  await fetch(`${env.orchestratorBase}/auth/logout`, { method: 'POST', credentials: 'include' })
}
