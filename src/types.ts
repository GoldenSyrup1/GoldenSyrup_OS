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

// --- Cowork bridge (Claude for Desktop → local state file) ------------------

/**
 * A task surfaced from Claude for Desktop's Cowork. Cowork is desktop-only and
 * stores project data locally with no cloud API, so the bridge is a JSON file it
 * writes into a connected folder; the OS reads it (see `data/cowork.ts`).
 */
export interface CoworkTask {
  id: string
  title: string
  /** Cowork project / category this task belongs to. */
  category: string
  status: Status
  /** 0..100 completion. */
  progress: number
  /** One-line current state — kept short so the board stays visual. */
  detail?: string
  /** ISO timestamp of the last update Cowork wrote. */
  updated?: string
}

/** The whole Cowork snapshot the desktop app writes to the bridge file. */
export interface CoworkState {
  tasks: CoworkTask[]
  /** ISO timestamp the snapshot was written. */
  generatedAt?: string
}

/** A category rolled up from its tasks for the "pick a category on the side" rail. */
export interface CoworkCategory {
  name: string
  taskCount: number
  /** Weighted-average progress across the category's tasks, 0..100. */
  progress: number
  /** Worst-case status across the category (blocked > progress > idle > live). */
  status: Status
}

// --- Architecture builder (flowchart / block canvas) ------------------------

export type ArchBlockKind = 'service' | 'datastore' | 'external' | 'client' | 'queue' | 'note'

/** A block on the architecture canvas (maps onto a React Flow node). */
export interface ArchBlock {
  id: string
  kind: ArchBlockKind
  label: string
  x: number
  y: number
}

/** A directed connection between two blocks (maps onto a React Flow edge). */
export interface ArchLink {
  id: string
  source: string
  target: string
  label?: string
}

/** A named architecture flowchart, persisted to localStorage. */
export interface Architecture {
  id: string
  name: string
  blocks: ArchBlock[]
  links: ArchLink[]
  createdAt: number
  updatedAt: number
}

// --- Fitness (ability-first tracking) ---------------------------------------

/** Training discipline an ability belongs to. Drives the left rail on the board. */
export type Discipline =
  | 'calisthenics'
  | 'plyometrics'
  | 'isometrics'
  | 'cardio'
  | 'flexibility'
  | 'taekwondo'
  | 'strength'

/** How an ability is measured. Determines the unit shown next to every number. */
export type AbilityMetric = 'reps' | 'hold' | 'distance' | 'time' | 'angle' | 'load' | 'binary'

/**
 * One rung on the ladder toward an ability (e.g. "wall handstand 60s" on the way
 * to a freestanding handstand). All values are entered by hand — nothing here is
 * measured or synced from a device.
 */
export interface ProgressionStep {
  id: string
  name: string
  /** Value that counts as owning this rung, in the ability's unit. */
  target: number
  /** Current best, manually entered. */
  current: number
  /**
   * Baseline for `lowerIsBetter` abilities (e.g. the 5k time you started from),
   * so partial credit is measurable when smaller numbers mean better.
   */
  start?: number
  note?: string
}

/** A manual entry against one rung, kept so a rung's trend is inspectable. */
export interface AbilityLog {
  /** ISO date (yyyy-mm-dd). */
  date: string
  stepId: string
  value: number
}

/**
 * A physical ability being chased — the unit of tracking. Progress is the share
 * of the progression ladder actually owned, not time spent training.
 */
export interface Ability {
  id: string
  name: string
  discipline: Discipline
  metric: AbilityMetric
  /** Overrides the metric's default unit label (e.g. 'm' instead of 'km'). */
  unit?: string
  /** What owning this ability looks like, in one line. */
  goal?: string
  /** True when a smaller number is better (a 5k time, a 100m sprint). */
  lowerIsBetter?: boolean
  /** Ordered easiest → hardest. */
  steps: ProgressionStep[]
  /** Parked for now (injury, off-season) — shown but excluded from "next up". */
  paused?: boolean
  history: AbilityLog[]
  createdAt: number
  updatedAt: number
}

/** A discipline rolled up from its abilities for the left rail. */
export interface DisciplineRollup {
  discipline: Discipline
  abilityCount: number
  /** Count of abilities fully owned (every rung at target). */
  ownedCount: number
  /** Mean progress across the discipline's abilities, 0..100. */
  progress: number
  /** Worst-case status across the discipline. */
  status: Status
}

/** The top-level views selectable from the sidebar rail. */
export type AppView = 'dashboard' | 'cowork' | 'architectures' | 'fitness'

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
