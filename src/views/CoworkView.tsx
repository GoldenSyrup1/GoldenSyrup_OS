import { SectionTitle } from '../components/Card'
import CoworkBoard from '../components/CoworkBoard'
import { useCowork } from '../hooks/useCowork'

export default function CoworkView() {
  const { tasks, categories, connection, generatedAt, refreshing, refresh } = useCowork()
  return (
    <div>
      <SectionTitle>🤝 Cowork</SectionTitle>
      <CoworkBoard
        tasks={tasks}
        categories={categories}
        connection={connection}
        generatedAt={generatedAt}
        refreshing={refreshing}
        onRefresh={refresh}
      />
    </div>
  )
}
