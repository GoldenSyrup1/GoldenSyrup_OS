import { useCallback, useEffect, useState } from 'react'
import { fetchAuthStatus, login } from '../lib/auth'

/**
 * Wraps the app in a password prompt when the deployment asks for one.
 *
 * Only the hosted instance does: that box holds an Anthropic API key on a
 * public URL. Running locally, the server reports `required: false` and this
 * renders its children straight through, so nothing changes on the laptop.
 */
export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'open' | 'locked'>('checking')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const check = useCallback(async () => {
    const s = await fetchAuthStatus()
    setStatus(!s.required || s.authed ? 'open' : 'locked')
  }, [])

  useEffect(() => {
    void check()
  }, [check])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password || busy) return
    setBusy(true)
    setError(null)
    try {
      await login(password)
      setPassword('')
      await check()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-sm text-gray-600">
        …
      </div>
    )
  }

  if (status === 'locked') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 p-6">
        <form
          onSubmit={submit}
          className="w-full max-w-xs space-y-3 rounded-xl border border-ink-600 bg-ink-800/80 p-5"
        >
          <div className="text-sm font-semibold text-syrup-100">🍯 GoldenSyrup OS</div>
          <p className="text-[11px] text-gray-500">This instance is password-protected.</p>
          <input
            type="password"
            aria-label="Password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-sm text-gray-200 focus:border-syrup-700 focus:outline-none"
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={!password || busy}
            className="w-full rounded-lg bg-syrup-500 px-4 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300 disabled:opacity-40"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
