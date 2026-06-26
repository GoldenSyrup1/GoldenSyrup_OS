import { useState } from 'react'
import type { Contact, Project } from '../types'

const REL_COLOR: Record<Contact['relationship'], string> = {
  mentor: '#3fb950',
  investor: '#f5c451',
  connector: '#58a6ff',
  peer: '#8b949e',
  lead: '#d29922',
}

/** Contact roster with a click-to-open detail drawer. */
export default function ContactPanel({
  contacts,
  projects,
}: {
  contacts: Contact[]
  projects: Project[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = contacts.find((c) => c.id === selectedId) ?? null
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? id

  return (
    <>
      <ul className="space-y-2">
        {contacts.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => setSelectedId(c.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-syrup-700 hover:shadow-glow"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-syrup-100">{c.name}</span>
                <span className="block truncate text-[11px] text-gray-500">{c.role}</span>
              </span>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                style={{ backgroundColor: `${REL_COLOR[c.relationship]}22`, color: REL_COLOR[c.relationship] }}
              >
                {c.relationship}
              </span>
            </button>
          </li>
        ))}
        {contacts.length === 0 && <p className="text-xs text-gray-600">No contacts yet.</p>}
      </ul>

      {/* drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`${selected.name} details`}>
          <button
            type="button"
            aria-label="Close details"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedId(null)}
          />
          <aside className="animate-slide-in relative h-full w-full max-w-sm overflow-y-auto border-l border-ink-600 bg-ink-800 p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-syrup-100">{selected.name}</h3>
                <p className="text-xs text-gray-400">{selected.role}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded p-1 text-gray-500 hover:text-syrup-300"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <dl className="space-y-3 text-sm">
              <Row label="Relationship">
                <span className="capitalize" style={{ color: REL_COLOR[selected.relationship] }}>
                  {selected.relationship}
                </span>
              </Row>
              {selected.lastTouch && <Row label="Last touch">{selected.lastTouch}</Row>}
              {selected.followUp && <Row label="Follow-up">{selected.followUp}</Row>}
              <Row label="Connects to">
                {selected.connectsTo.length === 0 ? (
                  <span className="text-gray-600">—</span>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {selected.connectsTo.map((id) => (
                      <span key={id} className="rounded bg-ink-700 px-2 py-0.5 text-[11px] text-syrup-300">
                        {projectName(id)}
                      </span>
                    ))}
                  </span>
                )}
              </Row>
            </dl>
          </aside>
        </div>
      )}
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-gray-600">{label}</dt>
      <dd className="mt-0.5 text-gray-300">{children}</dd>
    </div>
  )
}
