import { useState } from 'react'
import type { CommandNode, Project } from '../types'
import { commandTree } from '../data/commandTree'
import { useCommandConsole } from '../hooks/useCommandConsole'
import CommandTree from './CommandTree'
import RunQueue from './RunQueue'
import BudgetMeter from './BudgetMeter'

export default function CommandConsole({ projects }: { projects: Project[] }) {
  const { runs, submit, clearRun, cap, setCap, budget, runnerKind } = useCommandConsole()
  const [target, setTarget] = useState<CommandNode | null>(null)
  const [prompt, setPrompt] = useState('')

  const send = () => {
    if (!target || !prompt.trim()) return
    submit(target, prompt)
    setPrompt('')
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
      {/* Left: category tree + budget */}
      <div className="space-y-3">
        <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-2">
          <CommandTree nodes={commandTree} selectedId={target?.id ?? null} onSelect={setTarget} projects={projects} />
        </div>
        <BudgetMeter budget={budget} cap={cap} onCapChange={setCap} />
      </div>

      {/* Right: prompt box + run queue */}
      <div className="space-y-3">
        <div className="rounded-xl border border-ink-600 bg-ink-800/80 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-syrup-100">
              {target ? target.label : 'Select a target →'}
            </span>
            {target?.hint && <span className="truncate text-[11px] text-gray-500">· {target.hint}</span>}
            <span
              className="ml-auto rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide"
              style={{
                backgroundColor: runnerKind === 'orchestrator' ? '#3fb95022' : '#8b949e22',
                color: runnerKind === 'orchestrator' ? '#3fb950' : '#8b949e',
              }}
              title={runnerKind === 'orchestrator' ? 'Runs Claude Code via the local orchestrator' : 'Stub runner — set VITE_OS_ORCHESTRATOR_BASE to execute for real'}
            >
              {runnerKind === 'orchestrator' ? 'live runner' : 'stub'}
            </span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') send()
            }}
            placeholder={target ? `Prompt for ${target.label}… e.g. "find xrpl problemo"` : 'Pick a target from the tree first'}
            disabled={!target}
            rows={3}
            className="w-full resize-y rounded-lg border border-ink-600 bg-ink-900 p-2 text-sm text-gray-200 placeholder:text-gray-600 focus:border-syrup-700 focus:outline-none disabled:opacity-50"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[10px] text-gray-600">⌘/Ctrl + Enter to send</span>
            <button
              type="button"
              onClick={send}
              disabled={!target || !prompt.trim()}
              className="rounded-lg bg-syrup-500 px-4 py-1.5 text-xs font-semibold text-ink-900 transition-colors hover:bg-syrup-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>

        <RunQueue runs={runs} onClear={clearRun} />
      </div>
    </div>
  )
}
