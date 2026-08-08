import { contacts } from '../data/seed'
import type { Project } from '../types'
import { Card, SectionTitle } from '../components/Card'
import RelationshipMap from '../components/RelationshipMap'
import ContactPanel from '../components/ContactPanel'

/**
 * Manual contact tracking — pulled off the main Dashboard during the
 * chat-centric redesign (see `DashboardView.tsx`'s history) and given its own
 * nav destination here. `RelationshipMap` + `ContactPanel` are unchanged, just
 * relocated; `projects` comes from App's single `useLiveData()` instance so
 * project status stays consistent with every other view rather than going
 * stale on its own copy.
 *
 * Named "Connections" per the LinkedIn-adjacent request that created it, but
 * this is manual entry with an optional LinkedIn link-out per contact — real
 * connections-list sync isn't available to a personal app without LinkedIn's
 * Marketing Developer Platform partnership.
 */
export default function ConnectionsView({ projects }: { projects: Project[] }) {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-syrup-300">🔗 Connections</h1>
      <p className="mb-6 text-sm text-gray-500">
        Manually-tracked contacts, each optionally linked to a LinkedIn profile — LinkedIn's API
        doesn't offer a real connections sync to a personal app.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Relationship Map</SectionTitle>
          <RelationshipMap contacts={contacts} projects={projects} />
        </section>
        <section>
          <SectionTitle>Contacts</SectionTitle>
          <Card>
            <ContactPanel contacts={contacts} projects={projects} />
          </Card>
        </section>
      </div>
    </div>
  )
}
