import { useState } from 'react'
import type { AppView } from '../types'
import { NAV_TREE, isNavBranch, type NavBranch } from '../data/nav'

/** Which branch (if any) contains this leaf — used to auto-expand it on open. */
function branchContaining(view: AppView): string | null {
  for (const item of NAV_TREE) {
    if (isNavBranch(item) && item.children.some((c) => c.id === view)) return item.id
  }
  return null
}

/**
 * Left nav — a popover drawer triggered from the top nav's ☰ icon (per the
 * wireframe: "Pop up when you click the symbol to expand tabs"). Branches
 * (Pillars, Projects) expand in place; everything else navigates directly.
 */
export default function Sidebar({
  open,
  onClose,
  view,
  onSelectView,
  badges,
}: {
  open: boolean
  onClose: () => void
  view: AppView
  onSelectView: (v: AppView) => void
  /** Optional small count/indicator per view (e.g. active Cowork tasks). */
  badges?: Partial<Record<AppView, string>>
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const containing = branchContaining(view)
    return new Set(containing ? [containing] : [])
  })

  const toggleBranch = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const select = (v: AppView) => {
    onSelectView(v)
    onClose()
  }

  const renderLeaf = (id: AppView, label: string, icon: string | undefined, indent: boolean) => {
    const active = view === id
    return (
      <button
        key={id}
        type="button"
        onClick={() => select(id)}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-center gap-3 rounded-lg py-2 text-sm transition-colors ${
          indent ? 'pl-8 pr-2.5' : 'px-2.5'
        } ${
          active
            ? 'bg-syrup-500/15 text-syrup-200 ring-1 ring-syrup-700'
            : 'text-gray-400 hover:bg-ink-800 hover:text-gray-200'
        }`}
      >
        {icon && (
          <span className="text-base" aria-hidden>
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
        {badges?.[id] && (
          <span className="ml-auto rounded-full bg-ink-700 px-1.5 py-0.5 text-[10px] text-syrup-200">
            {badges[id]}
          </span>
        )}
      </button>
    )
  }

  const renderBranch = (branch: NavBranch) => {
    const isOpen = expanded.has(branch.id)
    const hasActiveChild = branch.children.some((c) => c.id === view)
    return (
      <div key={branch.id}>
        <button
          type="button"
          onClick={() => toggleBranch(branch.id)}
          aria-expanded={isOpen}
          className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
            hasActiveChild ? 'text-syrup-200' : 'text-gray-400 hover:bg-ink-800 hover:text-gray-200'
          }`}
        >
          <span className="text-base" aria-hidden>
            {branch.icon}
          </span>
          <span className="truncate">{branch.label}</span>
          <span className={`ml-auto text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden>
            ▸
          </span>
        </button>
        {isOpen && (
          <div className="mt-1 space-y-1">
            {branch.children.map((c) => renderLeaf(c.id, c.label, undefined, true))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        />
      )}
      <nav
        aria-label="Primary"
        aria-hidden={!open}
        className={`fixed left-0 top-12 z-50 flex h-[calc(100dvh-3rem)] w-64 flex-col gap-1 overflow-y-auto border-r border-ink-700 bg-ink-900/95 px-2 py-4 backdrop-blur-sm transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {NAV_TREE.map((item) =>
          isNavBranch(item) ? renderBranch(item) : renderLeaf(item.id, item.label, item.icon, false),
        )}
        <div className="mt-auto px-1 text-[10px] leading-relaxed text-gray-600">
          Personal command centre — Sriram only
        </div>
      </nav>
    </>
  )
}
