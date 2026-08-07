/**
 * Fixed top bar: ☰ on the left pops the nav sidebar, 📊 on the right pops the
 * Statistics/Tool Usage rail — the wireframe's "pop up when you click the
 * symbol" interaction for both drawers.
 */
export default function TopNav({
  leftOpen,
  rightOpen,
  onToggleLeft,
  onToggleRight,
}: {
  leftOpen: boolean
  rightOpen: boolean
  onToggleLeft: () => void
  onToggleRight: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-3 border-b border-ink-700 bg-ink-900/90 px-3 backdrop-blur-sm">
      <button
        type="button"
        onClick={onToggleLeft}
        aria-label="Toggle navigation"
        aria-expanded={leftOpen}
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${
          leftOpen ? 'bg-syrup-500/15 text-syrup-200' : 'text-gray-400 hover:bg-ink-800 hover:text-gray-200'
        }`}
      >
        ☰
      </button>

      <div className="flex flex-1 items-center justify-center gap-2 sm:justify-start">
        <span className="text-lg" aria-hidden>
          🍯
        </span>
        <span className="text-sm font-bold text-syrup-300">GoldenSyrup OS</span>
      </div>

      <button
        type="button"
        onClick={onToggleRight}
        aria-label="Toggle statistics"
        aria-expanded={rightOpen}
        className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${
          rightOpen ? 'bg-syrup-500/15 text-syrup-200' : 'text-gray-400 hover:bg-ink-800 hover:text-gray-200'
        }`}
      >
        📊
      </button>
    </header>
  )
}
