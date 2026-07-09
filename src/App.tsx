import { useState } from 'react'
import type { AppView } from './types'
import Sidebar from './components/Sidebar'
import DashboardView from './views/DashboardView'
import CoworkView from './views/CoworkView'
import ArchitecturesView from './views/ArchitecturesView'

export default function App() {
  const [view, setView] = useState<AppView>('dashboard')

  return (
    <div className="flex min-h-dvh">
      <Sidebar view={view} onSelectView={setView} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          {view === 'dashboard' && <DashboardView />}
          {view === 'cowork' && <CoworkView />}
          {view === 'architectures' && <ArchitecturesView />}
        </div>
      </main>
    </div>
  )
}
