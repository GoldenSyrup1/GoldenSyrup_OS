import { projects, contacts, milestones, jobs, trades } from './data/seed'
import { aggregateProgress, statusBreakdown } from './lib/util'
import { useLiveData } from './hooks/useLiveData'
import { Card, SectionTitle } from './components/Card'
import PillarGrid from './components/PillarGrid'
import ProjectGrid from './components/ProjectGrid'
import RelationshipMap from './components/RelationshipMap'
import ProgressRing from './components/ProgressRing'
import JobBoard from './components/JobBoard'
import EthTracker from './components/EthTracker'
import ActivityFeed from './components/ActivityFeed'

const STATE_BADGE: Record<string, { label: string; color: string }> = {
  loading: { label: 'syncing…', color: '#d29922' },
  live: { label: 'live', color: '#3fb950' },
  fallback: { label: 'seed', color: '#8b949e' },
}

export default function App() {
  const { pillars, activity, ethPrice, state } = useLiveData()
  const pillarProgress = aggregateProgress(pillars)
  const projectBreakdown = statusBreakdown(projects)
  const badge = STATE_BADGE[state]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
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
        <div className="flex items-center gap-6">
          <div className="text-center">
            <ProgressRing value={pillarProgress} size={56} label="Revolution" />
            <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">Revolution</p>
          </div>
          <div className="text-xs text-gray-400">
            <div>🟢 {projectBreakdown.live} live</div>
            <div>🟡 {projectBreakdown.progress} in progress</div>
            <div>⚪ {projectBreakdown.idle} idle</div>
          </div>
        </div>
      </header>

      <section className="mb-8">
        <SectionTitle>8 Revolution Pillars</SectionTitle>
        <PillarGrid pillars={pillars} />
      </section>

      <section className="mb-8">
        <SectionTitle>Project Dashboards</SectionTitle>
        <ProjectGrid projects={projects} />
      </section>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Relationship Map</SectionTitle>
          <RelationshipMap contacts={contacts} projects={projects} />
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
          <div className="space-y-2">
            {milestones.length === 0 && (
              <Card>
                <p className="text-xs text-gray-500">No upcoming milestones.</p>
              </Card>
            )}
            {milestones.map((m) => (
              <Card key={m.id}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-syrup-100">{m.title}</h3>
                  <span className="text-xs text-gray-500">{m.date}</span>
                </div>
                {m.detail && <p className="mt-1 text-xs text-gray-400">{m.detail}</p>}
              </Card>
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-10 border-t border-ink-700 pt-4 text-center text-[11px] text-gray-600">
        Data: claude_connector memory · GoldenSyrup_Intel signal · CoinGecko (ETH) · manual inputs
      </footer>
    </div>
  )
}
