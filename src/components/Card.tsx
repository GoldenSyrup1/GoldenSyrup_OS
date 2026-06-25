import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-ink-600 bg-ink-800 p-4 shadow-sm transition-colors hover:border-syrup-700 ${className}`}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-syrup-300">
      {children}
    </h2>
  )
}
