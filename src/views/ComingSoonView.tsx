import { Card } from '../components/Card'

/**
 * Empty-shell page for a sidebar leaf that has no data model or design yet
 * (Career, Uni, Scrapers, Tools, Projects>*, News, Events, Memories). Keeps the
 * full nav tree clickable end-to-end; each one gets built out once Sriram sends
 * a design for it — see design/wireframes/.
 */
export default function ComingSoonView({ title, icon }: { title: string; icon?: string }) {
  return (
    <div>
      <h1 className="mb-4 flex items-center gap-2 text-2xl font-bold text-syrup-300">
        {icon && <span aria-hidden>{icon}</span>}
        {title}
      </h1>
      <Card className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center">
        <span className="text-3xl" aria-hidden>
          🚧
        </span>
        <p className="text-sm text-gray-400">Coming soon — no design for this page yet.</p>
        <p className="text-xs text-gray-600">Drop a wireframe in design/wireframes/ to spec it out.</p>
      </Card>
    </div>
  )
}
