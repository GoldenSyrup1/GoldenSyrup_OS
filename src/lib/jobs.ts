import type { JobApplication } from '../types'

export const JOB_STAGES: Array<JobApplication['stage']> = [
  'researching',
  'applied',
  'interviewing',
  'offer',
  'rejected',
]

export const STAGE_LABEL: Record<JobApplication['stage'], string> = {
  researching: 'Researching',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
}

/** Group applications into columns keyed by stage (all stages present). Pure. */
export function groupByStage(jobs: JobApplication[]): Record<JobApplication['stage'], JobApplication[]> {
  const base = {
    researching: [],
    applied: [],
    interviewing: [],
    offer: [],
    rejected: [],
  } as Record<JobApplication['stage'], JobApplication[]>
  for (const j of jobs) base[j.stage].push(j)
  return base
}
