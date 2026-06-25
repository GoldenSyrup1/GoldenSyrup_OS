// Seed data for GoldenSyrup OS, sourced from claude_connector memory snapshots.
// This is the manual-input + last-known-state layer. Live signals (Intel pillar
// feed, WEPort status) are meant to overlay this via the data adapters later.

import type {
  Pillar,
  Project,
  Contact,
  Milestone,
  JobApplication,
  EthTrade,
} from '../types'

// The 8 revolution pillars (per GoldenSyrup_Intel taxonomy).
export const pillars: Pillar[] = [
  { id: 'government', name: 'Government', status: 'live', progress: 60, nextAction: 'Add legislation.gov.au + AusTender scrapers', signal: 'Hansard scraper live' },
  { id: 'military', name: 'Military / Security', status: 'idle', progress: 5, nextAction: 'Write first military scraper (configured-but-disabled)' },
  { id: 'cyber', name: 'Cyberspace', status: 'idle', progress: 5, nextAction: 'Write cyber scraper' },
  { id: 'finance', name: 'Finance', status: 'progress', progress: 35, nextAction: 'Merge RBA scraper branch; add more finance sources', signal: 'RBA media-release scraper added (2026-06-25)' },
  { id: 'law', name: 'Law', status: 'idle', progress: 5, nextAction: 'Write law scraper' },
  { id: 'education', name: 'Education', status: 'idle', progress: 5, nextAction: 'Write education scraper' },
  { id: 'trade', name: 'Trade', status: 'idle', progress: 5, nextAction: 'Write trade scraper' },
  { id: 'business', name: 'Business', status: 'idle', progress: 5, nextAction: 'Write business scraper' },
]

// Project dashboards.
export const projects: Project[] = [
  {
    id: 'weport',
    name: 'WEPort',
    status: 'live',
    progress: 95,
    summary: 'Unified Port Community System demo. Roadmap #1–#5 all done.',
    repo: 'GoldenSyrup1/WePort-Repo',
    liveUrl: 'https://weportglobal.org/weport_demo.html',
    nextAction: 'Replace embedded sanctions sample with live OFAC feed',
    stack: ['Python 3.13', 'Flask', 'SQLAlchemy', 'XRPL', 'Railway'],
  },
  {
    id: 'goldensyrup-intel',
    name: 'GoldenSyrup_Intel',
    status: 'progress',
    progress: 40,
    summary: 'Private 8-pillar intelligence scraper. MVP + 2 scrapers landed.',
    repo: 'GoldenSyrup1/GoldenSyrup_Intel',
    nextAction: 'Merge fix/entity-regex-qdrant-shutdown; add 6 remaining pillar scrapers',
    stack: ['Python', 'Qdrant', 'fastembed', 'PostgreSQL'],
  },
  {
    id: 'stall-in',
    name: 'Stall-In',
    status: 'live',
    progress: 80,
    summary: '10 backend microservices live on Railway, shared Postgres.',
    repo: 'GoldenSyrup1/Stall_In',
    nextAction: 'Frontend + end-to-end profit loop',
    stack: ['Node', 'Postgres', 'Railway'],
  },
  {
    id: 'claude-connector',
    name: 'claude_connector',
    status: 'live',
    progress: 90,
    summary: 'Memory backend (Railway) + GitHub Pages frontend + MCP server (4 tools).',
    nextAction: 'Anthropic native integration pitch (Phase 8)',
    stack: ['Node', 'Railway', 'MCP'],
  },
  { id: 'tracklink', name: 'TrackLink', status: 'idle', progress: 20, summary: 'People / relationship graph source.', nextAction: 'Define integration into OS contacts' },
  { id: 'stockup', name: 'StockUp', status: 'idle', progress: 10, summary: 'TBD.', nextAction: 'Define scope' },
  { id: 'cloud925', name: 'Cloud925', status: 'idle', progress: 10, summary: 'TBD.', nextAction: 'Define scope' },
  { id: 'solace', name: 'Solace', status: 'progress', progress: 30, summary: 'Introspective journal / agent layer.', nextAction: 'Continue entries' },
]

export const contacts: Contact[] = [
  {
    id: 'peter-ratcliffe',
    name: 'Peter Ratcliffe',
    role: 'CIO/CTO connector (AU/US/UK/SEA)',
    relationship: 'mentor',
    lastTouch: '2026-04',
    followUp: 'Sees port pain across multiple ports; willing to support 1yr post-launch',
    connectsTo: ['weport'],
  },
  {
    id: 'gavin-schwarz',
    name: 'Gavin Schwarz',
    role: 'Contact',
    relationship: 'connector',
    connectsTo: [],
  },
]

export const milestones: Milestone[] = [
  { id: 'rapid-agent-hack', title: 'Google Cloud Rapid Agent Hackathon (DutyBreak, $30K)', kind: 'hackathon', date: '2026-06-12', status: 'progress', detail: 'DutyBreak — AI duty/compliance layer for WEPort' },
]

// Sample rows so the views are demonstrable — replace with real entries.
export const jobs: JobApplication[] = [
  { id: 'j1', company: 'Atlassian', role: 'Associate SWE (grad)', stage: 'applied', updated: '2026-06-20' },
  { id: 'j2', company: 'Canva', role: 'Software Engineer Intern', stage: 'interviewing', updated: '2026-06-24' },
  { id: 'j3', company: 'Stripe', role: 'New Grad Engineer', stage: 'researching', updated: '2026-06-18' },
]

export const trades: EthTrade[] = [
  { id: 't1', side: 'long', entry: 2400, size: 1.5, status: 'open', note: 'swing' },
  { id: 't2', side: 'short', entry: 3100, size: 0.5, status: 'closed', pnlUsd: 180 },
]
