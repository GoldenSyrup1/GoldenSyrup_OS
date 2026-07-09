import { SectionTitle } from '../components/Card'
import ArchitectureCanvas from '../components/ArchitectureCanvas'
import { useArchitectures } from '../hooks/useArchitectures'

export default function ArchitecturesView() {
  const api = useArchitectures()

  const createNew = () => {
    const name = window.prompt('Name your architecture', 'New Architecture')
    if (name != null) api.create(name)
  }

  const renameCurrent = () => {
    if (!api.current) return
    const name = window.prompt('Rename architecture', api.current.name)
    if (name != null) api.rename(name)
  }

  const deleteCurrent = () => {
    if (!api.current) return
    if (window.confirm(`Delete "${api.current.name}"? This cannot be undone.`)) api.remove(api.current.id)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionTitle>🧩 Architectures</SectionTitle>
        <button
          type="button"
          onClick={createNew}
          className="rounded-lg bg-syrup-500 px-3 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300"
        >
          + New Architecture
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        {/* Saved architectures */}
        <div className="space-y-2">
          {api.list.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink-600 bg-ink-900 p-3 text-xs text-gray-500">
              No architectures yet. Create one to start building a flowchart.
            </p>
          )}
          {api.list.map((a) => {
            const active = a.id === api.currentId
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => api.select(a.id)}
                className={`block w-full rounded-xl border p-2.5 text-left transition-all ${
                  active ? 'border-syrup-700 bg-syrup-500/10' : 'border-ink-600 bg-ink-800/60 hover:border-ink-500'
                }`}
              >
                <span className="block truncate text-sm text-gray-100">{a.name}</span>
                <span className="block text-[11px] text-gray-500">
                  {a.blocks.length} block{a.blocks.length === 1 ? '' : 's'} · {a.links.length} link
                  {a.links.length === 1 ? '' : 's'}
                </span>
              </button>
            )
          })}
        </div>

        {/* Canvas + per-architecture actions */}
        <div className="space-y-3">
          {api.current && (
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-syrup-100">{api.current.name}</h3>
              <button
                type="button"
                onClick={renameCurrent}
                className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] text-gray-300 hover:border-syrup-700"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={deleteCurrent}
                className="rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-[11px] text-red-300 hover:border-red-700"
              >
                Delete
              </button>
            </div>
          )}
          <ArchitectureCanvas api={api} />
        </div>
      </div>
    </div>
  )
}
