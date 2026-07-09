import type { AppView } from '../types'

interface NavItem {
  id: AppView
  label: string
  icon: string
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'cowork', label: 'Cowork', icon: '🤝' },
  { id: 'architectures', label: 'Architectures', icon: '🧩' },
]

/**
 * Left category rail. Collapses to an icon strip under `sm`. Selecting a category
 * swaps the main view (App owns the `view` state).
 */
export default function Sidebar({
  view,
  onSelectView,
  badges,
}: {
  view: AppView
  onSelectView: (v: AppView) => void
  /** Optional small count/indicator per view (e.g. active Cowork tasks). */
  badges?: Partial<Record<AppView, string>>
}) {
  return (
    <nav
      aria-label="Primary"
      className="sticky top-0 flex h-dvh w-14 shrink-0 flex-col gap-1 border-r border-ink-700 bg-ink-900/80 px-2 py-4 backdrop-blur-sm sm:w-48"
    >
      <div className="mb-4 flex items-center gap-2 px-1">
        <span className="text-xl">🍯</span>
        <span className="hidden text-sm font-bold text-syrup-300 sm:inline">GoldenSyrup OS</span>
      </div>
      {NAV.map((item) => {
        const active = view === item.id
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectView(item.id)}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
              active
                ? 'bg-syrup-500/15 text-syrup-200 ring-1 ring-syrup-700'
                : 'text-gray-400 hover:bg-ink-800 hover:text-gray-200'
            }`}
          >
            <span className="text-base" aria-hidden>
              {item.icon}
            </span>
            <span className="hidden sm:inline">{item.label}</span>
            {badges?.[item.id] && (
              <span className="ml-auto hidden rounded-full bg-ink-700 px-1.5 py-0.5 text-[10px] text-syrup-200 sm:inline">
                {badges[item.id]}
              </span>
            )}
          </button>
        )
      })}
      <div className="mt-auto hidden px-1 text-[10px] leading-relaxed text-gray-600 sm:block">
        Personal command centre — Sriram only
      </div>
    </nav>
  )
}
