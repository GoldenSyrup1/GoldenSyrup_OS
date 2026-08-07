import { useEffect, useMemo, useState } from 'react'
import type { Architecture, CommandNode, Project } from '../types'
import { commandTree } from '../data/commandTree'
import { flattenLeaves } from '../lib/commandTree'
import { parseMilestoneCommand } from '../lib/milestoneBoard'
import type { CommandConsole as CommandConsoleApi } from '../hooks/useCommandConsole'
import type { MilestoneBoardApi } from '../hooks/useMilestoneBoard'
import { pickArchStore } from '../lib/archStore'
import ChatWindow from './ChatWindow'

const ALL_PROJECTS = 'all'

/**
 * `consoleApi` is owned by App (a single `useCommandConsole()` instance) so this
 * chat panel and the global Statistics rail read the same budget/run state
 * instead of two independently-instantiated counters drifting apart.
 *
 * Chat-centric layout per design/wireframes/01-main-dashboard.png: a
 * conversation window on top, the prompt input below it, then a row of
 * Project / Architecture / Tool selectors and the resolved file path — instead
 * of the old side-by-side tree-picker + queue layout.
 *
 * `/milestone <title> [#hackathon|#unsw|#event]` is a special case handled
 * entirely client-side (see `lib/milestoneBoard.ts`): it never reaches the
 * runner, doesn't need a tool selected, and lands straight on the Milestones
 * canvas — "mention an achievement in chat and it updates" from the redesign
 * conversation, as a deterministic command rather than free-form NLP.
 */
export default function CommandConsole({
  projects,
  consoleApi,
  milestoneBoard,
}: {
  projects: Project[]
  consoleApi: CommandConsoleApi
  milestoneBoard: MilestoneBoardApi
}) {
  const { runs, submit, runnerKind } = consoleApi
  const [target, setTarget] = useState<CommandNode | null>(null)
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS)
  const [prompt, setPrompt] = useState('')
  const [note, setNote] = useState<string | null>(null)
  // Read-only view of the saved diagrams — the Architectures view owns editing
  // them, this only needs the list to attach one as context.
  const [architectures, setArchitectures] = useState<Architecture[]>([])
  const [archId, setArchId] = useState('')

  useEffect(() => {
    let cancelled = false
    pickArchStore()
      .load()
      .then((list) => {
        if (!cancelled) setArchitectures(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const leaves = useMemo(() => flattenLeaves(commandTree), [])

  // Projects worth offering: the ones an actual tool target links to.
  const projectOptions = useMemo(() => {
    const ids = new Set(leaves.map((l) => l.projectId).filter((id): id is string => Boolean(id)))
    return projects.filter((p) => ids.has(p.id))
  }, [leaves, projects])

  const toolOptions = useMemo(
    () => (projectFilter === ALL_PROJECTS ? leaves : leaves.filter((l) => l.projectId === projectFilter)),
    [leaves, projectFilter],
  )

  // Selecting a project that the current tool doesn't belong to clears it,
  // rather than leaving a mismatched project/tool pair silently in place.
  const onProjectChange = (id: string) => {
    setProjectFilter(id)
    if (target && id !== ALL_PROJECTS && target.projectId !== id) setTarget(null)
  }

  const onToolChange = (id: string) => {
    setTarget(leaves.find((l) => l.id === id) ?? null)
  }

  const attached = architectures.find((a) => a.id === archId)
  const isMilestoneCommand = parseMilestoneCommand(prompt) !== null

  const send = () => {
    const text = prompt.trim()
    if (!text) return

    if (milestoneBoard.tryAddAchievement(text)) {
      setNote(`✓ Milestone added to the board below.`)
      setPrompt('')
      return
    }

    if (!target) return
    submit(target, text, attached)
    setPrompt('')
  }

  return (
    <div className="space-y-3">
      {/* Chat window */}
      <div className="h-[360px] overflow-y-auto rounded-xl border border-ink-600 bg-ink-900 p-3">
        <ChatWindow runs={runs} />
      </div>

      {/* Chat input */}
      <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-syrup-100">
            {target ? target.label : 'Pick a project + tool below →'}
          </span>
          {target?.hint && <span className="truncate text-[11px] text-gray-500">· {target.hint}</span>}
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide"
            style={{
              backgroundColor: runnerKind === 'orchestrator' ? '#3fb95022' : '#8b949e22',
              color: runnerKind === 'orchestrator' ? '#3fb950' : '#8b949e',
            }}
            title={
              runnerKind === 'orchestrator'
                ? 'Runs Claude Code via the local orchestrator'
                : 'Stub runner — set VITE_OS_ORCHESTRATOR_BASE to execute for real'
            }
          >
            {runnerKind === 'orchestrator' ? 'live runner' : 'stub'}
          </span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value)
            if (note) setNote(null)
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
          }}
          placeholder={
            target ? `Prompt for ${target.label}… e.g. "find xrpl problemo"` : 'Pick a tool below, or type /milestone <title> to log an achievement'
          }
          rows={3}
          className="w-full resize-y rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-gray-600">
            {note ?? '⌘/Ctrl + Enter to send · /milestone <title> logs an achievement'}
          </span>
          <button
            type="button"
            onClick={send}
            disabled={!prompt.trim() || (!target && !isMilestoneCommand)}
            className="rounded-lg bg-syrup-500 px-4 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>

      {/* Project / Architecture / Tool selection row */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-[10px] text-gray-500">
          Project selection
          <select
            aria-label="Project selection"
            value={projectFilter}
            onChange={(e) => onProjectChange(e.target.value)}
            className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-gray-200 focus:border-syrup-700 focus:outline-none"
          >
            <option value={ALL_PROJECTS}>All projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[10px] text-gray-500">
          Architecture
          <select
            aria-label="Attach architecture as context"
            value={archId}
            onChange={(e) => setArchId(e.target.value)}
            disabled={architectures.length === 0}
            className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-gray-200 focus:border-syrup-700 focus:outline-none disabled:opacity-50"
          >
            <option value="">no architecture</option>
            {architectures.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.blocks.length})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[10px] text-gray-500">
          Tool selection(s)
          <select
            aria-label="Tool selection"
            value={target?.id ?? ''}
            onChange={(e) => onToolChange(e.target.value)}
            className="rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 text-xs text-gray-200 focus:border-syrup-700 focus:outline-none"
          >
            <option value="">select a tool…</option>
            {toolOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* File path — resolved from the selected tool's project. */}
      <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-1.5 text-[11px] text-gray-500">
        <span className="text-gray-600">File path (referenced from Projects):</span>{' '}
        {target?.path ?? <span className="text-gray-700">—</span>}
      </div>
    </div>
  )
}
