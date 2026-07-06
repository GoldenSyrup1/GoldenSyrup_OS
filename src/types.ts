// Shared domain types for GoldenSyrup OS — the personal command centre.

export type Status = 'live' | 'progress' | 'blocked' | 'idle'

/** One of the 8 revolution pillars. */
export interface Pillar {
  id: string
  name: string
  status: Status
  /** 0..100 completion of the pillar's current objective. */
  progress: number
  nextAction: string
  signal?: string // latest cross-pillar signal from GoldenSyrup_Intel
}

/** A GoldenSyrup product / project surfaced as a dashboard tile. */
export interface Project {
  id: string
  name: string
  status: Status
  progress: number
  summary: string
  repo?: string
  liveUrl?: string
  nextAction: string
  stack?: string[]
}

/** A person in the relationship map. */
export interface Contact {
  id: string
  name: string
  role: string
  relationship: 'mentor' | 'investor' | 'connector' | 'peer' | 'lead'
  lastTouch?: string
  followUp?: string
  /** ids of projects this contact connects to. */
  connectsTo: string[]
}

export interface Milestone {
  id: string
  title: string
  kind: 'hackathon' | 'unsw' | 'event'
  date: string // ISO
  status: Status
  detail?: string
}

export interface JobApplication {
  id: string
  company: string
  role: string
  stage: 'researching' | 'applied' | 'interviewing' | 'offer' | 'rejected'
  updated: string
}

export interface EthTrade {
  id: string
  side: 'long' | 'short'
  entry: number
  size: number // ETH
  status: 'open' | 'closed'
  pnlUsd?: number
  note?: string
}

// --- Command console (prompt → Claude Code) ---------------------------------

/**
 * A node in the command tree. A branch has `children`; a leaf (no children) is
 * a promptable target you can dispatch work at.
 */
export interface CommandNode {
  id: string
  label: string
  icon?: string
  /** Sub-categories / targets. Absent or empty ⇒ a promptable leaf. */
  children?: CommandNode[]
  /** For leaves: absolute local repo path the orchestrator runs Claude Code in. */
  path?: string
  /** For leaves: linked Project id (surfaces its live status in the tree). */
  projectId?: string
  /** For leaves: one-line hint shown under the prompt box. */
  hint?: string
}

export type RunStatus = 'queued' | 'running' | 'done' | 'failed'

/** A single prompt dispatched at a target, plus its streamed lifecycle. */
export interface Run {
  id: string
  targetId: string
  targetLabel: string
  prompt: string
  status: RunStatus
  createdAt: number
  /** Streamed progress lines, oldest first. */
  log: string[]
  result?: string
  error?: string
  /** USD cost reported by the runner once complete (0 for the stub runner). */
  costUsd?: number
}
