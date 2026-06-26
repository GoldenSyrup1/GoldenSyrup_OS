import { contacts, milestones, jobs, projects, trades } from './data/seed'
import { aggregateProgress, statusBreakdown } from './lib/util'
import { useLiveData } from './hooks/useLiveData'
import { Card, SectionTitle } from './components/Card'
import PillarGrid from './components/PillarGrid'
import ProjectGrid from './components/ProjectGrid'
import RelationshipMap from './components/RelationshipMap'
import ProgressRing from './components/ProgressRing'
import RadarChart from './components/RadarChart'
import Timeline from './components/Timeline'
import ContactPanel from './components/ContactPanel'
import JobBoard from './components/JobBoard'
import EthTracker from './components/EthTracker'
import ActivityFeed from './components/ActivityFeed'

const STATE_BADGE: Record<string, { label: string; color: string }> = {
  loading: { label: 'syncing…', color: '#d29922' },
  live: { label: 'live', color: '#3fb950' },
  fallback: { label: 'seed', color: '#8b949e' },
}

function formatUpdated(ts: number | null): string {
  if (ts === null) return '—'
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
}

export default function App() {
  const { pillars, activity, ethPrice, state, lastUpdated, refreshing, refresh } = useLiveData()
  const pillarProgress = aggregateProgress(pillars)
  const projectBreakdown = statusBreakdown(projects)
  const badge = STATE_BADGE[state]
  const now = new Date().toISOString()

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
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
        <SectionTitle>8 Revolution Pillars</SectionTitle>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          <Card className="flex items-center justify-center">
            <RadarChart pillars={pillars} />
          </Card>
          <PillarGrid pillars={pillars} />
        </div>
      </section>

      <section className="mb-8 animate-fade-in">
        <SectionTitle>Project Dashboards</SectionTitle>
        <ProjectGrid projects={projects} />
      </section>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Relationship Map</SectionTitle>
          <RelationshipMap contacts={contacts} projects={projects} />
          <div className="mt-3">
            <ContactPanel contacts={contacts} projects={projects} />
          </div>
        </section>

        <section>
          <SectionTitle>Live Activity (claude_connector)</SectionTitle>
          <ActivityFeed items={activity} />
        </section>
      </div>

      <section className="mb-8">
        <SectionTitle>Job Search</SectionTitle>
        <JobBoard jobs={jobs} />
      </section>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>ETH Trades</SectionTitle>
          <EthTracker trades={trades} price={ethPrice} />
        </section>

        <section>
          <SectionTitle>Hackathons & Milestones</SectionTitle>
          <Card>
            <Timeline milestones={milestones} now={now} />
          </Card>
        </section>
      </div>

      <footer className="mt-10 border-t border-ink-700 pt-4 text-center text-[11px] text-gray-600">
        Data: claude_connector memory · GoldenSyrup_Intel signal · CoinGecko (ETH) · manual inputs
      </footer>
    </div>
  )
}
