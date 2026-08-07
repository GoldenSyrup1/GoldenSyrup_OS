import { aggregateProgress, statusBreakdown } from '../lib/util'
import type { LiveData } from '../hooks/useLiveData'
import type { CommandConsole as CommandConsoleApi } from '../hooks/useCommandConsole'
import type { MilestoneBoardApi } from '../hooks/useMilestoneBoard'
import { Card, SectionTitle } from '../components/Card'
import PillarGrid from '../components/PillarGrid'
import ProgressRing from '../components/ProgressRing'
import RadarChart from '../components/RadarChart'
import MilestoneCanvas from '../components/MilestoneCanvas'
import CommandConsole from '../components/CommandConsole'

const STATE_BADGE: Record<string, { label: string; color: string }> = {
  loading: { label: 'syncing…', color: '#d29922' },
  live: { label: 'live', color: '#3fb950' },
  fallback: { label: 'seed', color: '#8b949e' },
}

function formatUpdated(ts: number | null): string {
  if (ts === null) return '—'
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Chat-centric per design/wireframes/01-main-dashboard.png: Chat Window up top,
 * 8 Pillars grid, then Milestones. `live` and `console` are single instances
 * owned by App (not re-instantiated here) so the global Statistics rail and
 * per-pillar detail pages see the same data.
 *
 * Project Dashboards / Relationship Map / ETH Tracker / Job Board / Activity
 * Feed dropped from this view per Sriram's call — they'll come back once he
 * designs where each belongs in the new nav tree (Projects, Career, etc.).
 */
export default function DashboardView({
  live,
  consoleApi,
  milestoneBoard,
}: {
  live: LiveData
  consoleApi: CommandConsoleApi
  milestoneBoard: MilestoneBoardApi
}) {
  const { pillars, projects, state, lastUpdated, refreshing, refresh } = live
  const pillarProgress = aggregateProgress(pillars)
  const projectBreakdown = statusBreakdown(projects)
  const badge = STATE_BADGE[state]

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-syrup-300">
            🍯 GoldenSyrup OS
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: `${badge.color}22`, color: badge.color }}
            >
              {badge.label}
            </span>
          </h1>
          <p className="text-sm text-gray-500">Personal command centre — Sriram only</p>
        </div>
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-center">
            <ProgressRing value={pillarProgress} size={56} label="Revolution" />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">Revolution</p>
          </div>
          <div className="text-xs text-gray-400">
            <div>🟢 {projectBreakdown.live} live</div>
            <div>🟡 {projectBreakdown.progress} in progress</div>
            <div>⚪ {projectBreakdown.idle} idle</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-xs text-syrup-300 transition-colors hover:border-syrup-700 disabled:opacity-50"
            >
              <span className={refreshing ? 'inline-block animate-spin' : ''}>↻</span> Refresh
            </button>
            <span className="text-[10px] text-gray-600">updated {formatUpdated(lastUpdated)}</span>
          </div>
        </div>
      </header>

      <section className="mb-8 animate-fade-in">
        <SectionTitle>💬 Chat</SectionTitle>
        <CommandConsole projects={projects} consoleApi={consoleApi} milestoneBoard={milestoneBoard} />
      </section>

      <section className="mb-8 animate-fade-in">
        <SectionTitle>8 Revolution Pillars</SectionTitle>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          <Card className="flex items-center justify-center">
            <RadarChart pillars={pillars} />
          </Card>
          <PillarGrid pillars={pillars} />
        </div>
      </section>

      <section className="mb-8 animate-fade-in">
        <SectionTitle>Milestones</SectionTitle>
        <MilestoneCanvas api={milestoneBoard} />
      </section>

      <footer className="mt-10 border-t border-ink-700 pt-4 text-center text-[11px] text-gray-600">
        Data: claude_connector memory · GoldenSyrup_Intel signal · manual inputs
      </footer>
    </div>
  )
}
