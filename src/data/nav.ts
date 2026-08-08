// The left sidebar's nav tree — Sriram's Figma wireframe (design/wireframes/01-main-dashboard.png)
// asked for a deep expandable tree rather than the old flat 4-item rail. Edit
// freely; this is presentation only, not a schema anything else depends on.

import type { AppView } from '../types'

export interface NavLeaf {
  id: AppView
  label: string
  icon?: string
}

export interface NavBranch {
  /** Branches aren't navigable themselves — only their leaves are — so this id
   * is just an expand/collapse key, not an `AppView`. */
  id: string
  label: string
  icon?: string
  children: NavLeaf[]
}

export type NavItem = NavLeaf | NavBranch

export function isNavBranch(item: NavItem): item is NavBranch {
  return 'children' in item
}

export const NAV_TREE: NavItem[] = [
  { id: 'dashboard', label: 'Main Dashboard', icon: '🏠' },
  { id: 'cowork', label: 'Cowork', icon: '🤝' },
  {
    id: 'pillars',
    label: 'Pillars',
    icon: '🏛️',
    children: [
      { id: 'pillar-finance', label: 'Finance' },
      { id: 'pillar-business', label: 'Business' },
      { id: 'pillar-government', label: 'Government' },
      { id: 'pillar-law', label: 'Law' },
      { id: 'pillar-education', label: 'Education' },
      { id: 'pillar-military', label: 'Military' },
      { id: 'pillar-trade', label: 'Trade' },
      { id: 'pillar-cyber', label: 'Cyberspace' },
    ],
  },
  { id: 'career', label: 'Career', icon: '💼' },
  { id: 'connections', label: 'Connections', icon: '🔗' },
  { id: 'uni', label: 'Uni', icon: '🎓' },
  { id: 'fitness', label: 'Fitness', icon: '💪' },
  { id: 'architectures', label: 'Architectures', icon: '🧩' },
  { id: 'scrapers', label: 'Scrapers', icon: '🕷️' },
  { id: 'tools', label: 'Tools', icon: '🛠️' },
  {
    id: 'projects',
    label: 'Projects',
    icon: '🚀',
    children: [
      { id: 'projects-startups', label: 'Startups' },
      { id: 'projects-other', label: 'Other Projects' },
    ],
  },
  { id: 'news', label: 'News (not generic)', icon: '📰' },
  { id: 'events', label: 'Events/Announcements', icon: '📅' },
  { id: 'memories', label: 'Memories', icon: '🧠' },
]
