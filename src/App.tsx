import { useState } from 'react'
import type { AppView, PillarViewId } from './types'
import { useLiveData } from './hooks/useLiveData'
import { useCommandConsole } from './hooks/useCommandConsole'
import { useMilestoneBoard } from './hooks/useMilestoneBoard'
import TopNav from './components/TopNav'
import Sidebar from './components/Sidebar'
import StatsRail from './components/StatsRail'
import DashboardView from './views/DashboardView'
import CoworkView from './views/CoworkView'
import ArchitecturesView from './views/ArchitecturesView'
import FitnessView from './views/FitnessView'
import PillarView from './views/PillarView'
import ConnectionsView from './views/ConnectionsView'
import ComingSoonView from './views/ComingSoonView'

const PLACEHOLDER_TITLES: Partial<Record<AppView, { title: string; icon?: string }>> = {
  career: { title: 'Career', icon: '💼' },
  uni: { title: 'Uni', icon: '🎓' },
  scrapers: { title: 'Scrapers', icon: '🕷️' },
  tools: { title: 'Tools', icon: '🛠️' },
  'projects-startups': { title: 'Startups', icon: '🚀' },
  'projects-other': { title: 'Other Projects', icon: '🚀' },
  news: { title: 'News (not generic)', icon: '📰' },
  events: { title: 'Events/Announcements', icon: '📅' },
  memories: { title: 'Memories', icon: '🧠' },
}

export default function App() {
  const [view, setView] = useState<AppView>('dashboard')
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)

  // Owned once here — DashboardView, PillarView and the global StatsRail all
  // read from the same instances instead of each mounting their own hook and
  // drifting out of sync with the others.
  const live = useLiveData()
  const consoleApi = useCommandConsole()
  const milestoneBoard = useMilestoneBoard()

  const placeholder = PLACEHOLDER_TITLES[view]

  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav
        leftOpen={leftOpen}
        rightOpen={rightOpen}
        onToggleLeft={() => setLeftOpen((v) => !v)}
        onToggleRight={() => setRightOpen((v) => !v)}
      />

      <Sidebar open={leftOpen} onClose={() => setLeftOpen(false)} view={view} onSelectView={setView} />
      <StatsRail
        open={rightOpen}
        onClose={() => setRightOpen(false)}
        budget={consoleApi.budget}
        cap={consoleApi.cap}
        onCapChange={consoleApi.setCap}
      />

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {view === 'dashboard' && (
            <DashboardView live={live} consoleApi={consoleApi} milestoneBoard={milestoneBoard} />
          )}
          {view === 'cowork' && <CoworkView />}
          {view === 'architectures' && <ArchitecturesView />}
          {view === 'fitness' && <FitnessView />}
          {view === 'connections' && <ConnectionsView projects={live.projects} />}
          {view.startsWith('pillar-') && <PillarView view={view as PillarViewId} pillars={live.pillars} />}
          {placeholder && <ComingSoonView title={placeholder.title} icon={placeholder.icon} />}
        </div>
      </main>
    </div>
  )
}
