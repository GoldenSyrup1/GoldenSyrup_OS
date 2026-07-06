// The navigable command map: categories → promptable targets. Each leaf carries
// the local repo `path` the orchestrator will run Claude Code in (cwd). Paths are
// machine-specific; the shell works fine without them (stub runner ignores path).
// Edit freely — this is Sriram's personal taxonomy, not a fixed schema.

import type { CommandNode } from '../types'

const ROOT = 'C:/Users/srira/OneDrive/Documents/STARTUPS'

export const commandTree: CommandNode[] = [
  {
    id: 'startups',
    label: 'Startups / Projects',
    icon: '🚀',
    children: [
      { id: 't-weport', label: 'WEPort', projectId: 'weport', path: `${ROOT}/WePort-Repo`, hint: 'Port Community System + XRPL escrow' },
      { id: 't-cloud925', label: 'Cloud925', projectId: 'cloud925', path: `${ROOT}/Cloud925`, hint: 'Done-for-you digital presence (live)' },
      { id: 't-intel', label: 'GoldenSyrup_Intel', projectId: 'goldensyrup-intel', path: `${ROOT}/GoldenSyrup_Intel`, hint: '8-pillar intelligence scraper' },
      { id: 't-stallin', label: 'Stall-In', projectId: 'stall-in', path: `${ROOT}/Stall_In Startup`, hint: '10 microservices on Railway' },
      { id: 't-connector', label: 'claude_connector', projectId: 'claude-connector', hint: 'Memory backend + MCP server' },
      { id: 't-os', label: 'GoldenSyrup_OS', path: `${ROOT}/GoldenSyrup_OS`, hint: 'This command centre' },
    ],
  },
  {
    id: 'passion',
    label: 'Passion Projects',
    icon: '🎮',
    children: [
      { id: 't-snakeai', label: 'SnakeAI', hint: 'Reinforcement-learning snake' },
      { id: 't-games', label: 'Games', hint: 'Personal game builds' },
    ],
  },
  {
    id: 'career',
    label: 'Career',
    icon: '🎓',
    children: [
      { id: 't-university', label: 'University (UNSW)', hint: 'Courses, deadlines, milestones' },
      { id: 't-extracurricular', label: 'Extracurricular', hint: 'Clubs, hackathons, events' },
      { id: 't-jobsearch', label: 'Job Search', projectId: undefined, hint: 'Applications & interviews' },
    ],
  },
  {
    id: 'organisation',
    label: 'Organisation',
    icon: '🗂️',
    children: [
      { id: 't-schedule', label: 'Schedule & Time', hint: 'Plans, times, reminders' },
      { id: 't-architecture', label: 'Architecture', hint: 'Visual system diagrams (Lucidchart-style)' },
    ],
  },
]
