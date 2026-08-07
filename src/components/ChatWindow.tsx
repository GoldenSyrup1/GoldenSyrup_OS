import { useEffect, useRef } from 'react'
import type { Run } from '../types'
import { RUN_STATUS_COLOR, RUN_STATUS_LABEL, isActive } from '../lib/runs'

function time(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

/**
 * The wireframe's "Chat Window" — runs rendered oldest-first as a conversation
 * (prompt on the right, response on the left) instead of `RunQueue`'s
 * newest-first card list. Same `Run[]` data, different presentation; the
 * dispatch/queue semantics still live in `useCommandConsole`.
 */
export default function ChatWindow({ runs }: { runs: Run[] }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // jsdom (unit tests) has no scrollIntoView implementation at all.
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [runs.length, runs[runs.length - 1]?.status, runs[runs.length - 1]?.log.length])

  if (runs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-gray-600">
        <span className="text-2xl" aria-hidden>
          💬
        </span>
        <p className="text-xs">Pick a project + tool below, then send a prompt to start.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {runs.map((r) => {
        const color = RUN_STATUS_COLOR[r.status]
        return (
          <div key={r.id} className="space-y-1.5">
            {/* Prompt — the "user" side of the conversation. */}
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-syrup-500/15 px-3 py-2 text-sm text-syrup-100 ring-1 ring-syrup-700/60">
                <div className="mb-0.5 text-[10px] text-syrup-300/80">
                  {r.targetLabel} · {time(r.createdAt)}
                </div>
                {r.prompt}
              </div>
            </div>

            {/* Response — the "assistant" side. */}
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-xl rounded-tl-sm bg-ink-800 px-3 py-2 text-sm text-gray-200 ring-1 ring-ink-600">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide" style={{ color }}>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${isActive(r.status) ? 'animate-glow-pulse' : ''}`}
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  {RUN_STATUS_LABEL[r.status]}
                </div>
                {r.log.length > 0 && (
                  <div className="space-y-0.5 rounded bg-ink-900 p-2 font-mono text-[10px] leading-relaxed text-gray-500">
                    {r.log.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                )}
                {r.result && (
                  <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] text-gray-300">{r.result}</pre>
                )}
                {r.error && <p className="mt-1 text-[11px] text-status-blocked">{r.error}</p>}
                {typeof r.costUsd === 'number' && r.costUsd > 0 && (
                  <p className="mt-1 text-right text-[10px] text-gray-600">${r.costUsd.toFixed(3)}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}
