import { useEffect, useState } from 'react'
import type { CoworkCategory, CoworkTask } from '../types'
import { statusColor } from '../lib/util'
import { Card } from './Card'
import ProgressRing from './ProgressRing'
import StatusDot from './StatusDot'

interface Props {
  tasks: CoworkTask[]
  categories: CoworkCategory[]
  connection: 'loading' | 'connected' | 'absent'
  generatedAt: string | null
  refreshing: boolean
  onRefresh: () => void
}

/** Visual Cowork board: pick a category on the left, see its tasks' progress on the right. */
export default function CoworkBoard({
  tasks,
  categories,
  connection,
  generatedAt,
  refreshing,
  onRefresh,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null)

  // Keep a valid selection as categories change; default to the first one.
  useEffect(() => {
    if (categories.length === 0) {
      setSelected(null)
    } else if (!selected || !categories.some((c) => c.name === selected)) {
      setSelected(categories[0].name)
    }
  }, [categories, selected])

  const active = categories.find((c) => c.name === selected) ?? null
  const shown = tasks.filter((t) => t.category === selected)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <ConnectionBadge connection={connection} />
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-syrup-300 transition-colors hover:border-syrup-700 disabled:opacity-50"
        >
          <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span> Refresh
        </button>
        {generatedAt && (
          <span className="text-[10px] text-gray-600">
            snapshot {new Date(generatedAt).toLocaleString('en-AU', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>

      {connection === 'absent' ? (
        <BridgeHelp />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <CategoryRail categories={categories} selected={selected} onSelect={setSelected} />
          <CategoryPanel category={active} tasks={shown} />
        </div>
      )}

      <TaskComposer categories={categories.map((c) => c.name)} />
    </div>
  )
}

function ConnectionBadge({ connection }: { connection: Props['connection'] }) {
  const map = {
    loading: { label: 'connecting…', color: '#d29922' },
    connected: { label: 'Cowork connected', color: '#3fb950' },
    absent: { label: 'bridge not found', color: '#8b949e' },
  } as const
  const b = map[connection]
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[11px] font-medium"
      style={{ backgroundColor: `${b.color}22`, color: b.color }}
    >
      🤝 {b.label}
    </span>
  )
}

function CategoryRail({
  categories,
  selected,
  onSelect,
}: {
  categories: CoworkCategory[]
  selected: string | null
  onSelect: (name: string) => void
}) {
  return (
    <div className="flex flex-col gap-2" role="tablist" aria-label="Cowork categories">
      {categories.map((c) => {
        const active = c.name === selected
        return (
          <button
            key={c.name}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(c.name)}
            className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
              active
                ? 'border-syrup-700 bg-syrup-500/10'
                : 'border-ink-600 bg-ink-800/60 hover:border-ink-500'
            }`}
          >
            <ProgressRing value={c.progress} size={40} stroke={4} color={statusColor(c.status)} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-gray-100">{c.name}</span>
              <span className="block text-[11px] text-gray-500">
                {c.taskCount} task{c.taskCount === 1 ? '' : 's'}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function CategoryPanel({ category, tasks }: { category: CoworkCategory | null; tasks: CoworkTask[] }) {
  if (!category) return <Card className="text-sm text-gray-500">No categories yet.</Card>
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <ProgressRing value={category.progress} size={52} color={statusColor(category.status)} />
        <div>
          <h3 className="text-base font-semibold text-syrup-100">{category.name}</h3>
          <StatusDot status={category.status} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} />
        ))}
      </div>
    </div>
  )
}

function TaskCard({ task }: { task: CoworkTask }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-gray-100">{task.title}</span>
        <ProgressRing value={task.progress} size={38} stroke={4} color={statusColor(task.status)} />
      </div>
      {task.detail && <p className="line-clamp-2 text-xs text-gray-400">{task.detail}</p>}
      <div className="mt-auto flex items-center justify-between pt-1">
        <StatusDot status={task.status} />
        {task.updated && (
          <span className="text-[10px] text-gray-600">
            {new Date(task.updated).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })}
          </span>
        )}
      </div>
    </Card>
  )
}

/**
 * Honest interaction: the browser can't write into Cowork's local folder, so this
 * formats a task assignment and copies it to the clipboard for the user to paste
 * into Claude for Desktop's Cowork. No fake write-back.
 */
function TaskComposer({ categories }: { categories: string[] }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const body = text.trim()
    if (!body) return
    const payload = category ? `[${category}] ${body}` : body
    try {
      await navigator.clipboard.writeText(`Cowork task: ${payload}`)
      setCopied(true)
      setText('')
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-syrup-100">
        ➕ Assign a task to Cowork
        <span className="text-[11px] font-normal text-gray-500">· copies for paste into the desktop app</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Describe a task for Cowork to pick up…"
        className="w-full resize-y rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          list="cowork-cats"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="category (optional)"
          className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
        />
        <datalist id="cowork-cats">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <button
          type="button"
          onClick={copy}
          disabled={!text.trim()}
          className="ml-auto rounded-lg bg-syrup-500 px-4 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {copied ? 'Copied ✓' : 'Copy for Cowork'}
        </button>
      </div>
    </div>
  )
}

function BridgeHelp() {
  return (
    <Card className="space-y-2 text-sm text-gray-300">
      <p className="font-semibold text-syrup-100">Connect the Cowork bridge</p>
      <p className="text-gray-400">
        Cowork (Claude for Desktop) is local-only with no API, so the OS reads a JSON file it writes into a
        connected folder. To wire it up:
      </p>
      <ol className="ml-4 list-decimal space-y-1 text-gray-400">
        <li>In Claude for Desktop, connect this project folder to Cowork.</li>
        <li>
          Have Cowork keep <code className="rounded bg-ink-900 px-1 text-syrup-200">public/cowork-state.json</code>{' '}
          updated with <code className="rounded bg-ink-900 px-1 text-syrup-200">{'{ tasks: [...] }'}</code>.
        </li>
        <li>This board refreshes every 15s and lights up automatically.</li>
      </ol>
    </Card>
  )
}
