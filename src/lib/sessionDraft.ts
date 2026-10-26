import type { ScheduledDay } from './schedule';
import type { Step } from './workout';
import type { SetLog, WorkoutSession } from '@/store/types';

export type SessionDetails = {
  session: WorkoutSession;
  kicker: string;
  scheduledDate?: string;
  notes: string[];
  dayStatus?: ScheduledDay;
};

export type SessionDraft = {
  version: 1;
  routeId: string;
  resolved: SessionDetails;
  steps: Step[];
  phase: 'running' | 'done';
  index: number;
  remainingMs: number | null;
  elapsedMs: number;
  results: Record<number, SetLog>;
  draftReps: number;
  draftWeight: number;
  difficulty: number;
  energy: number;
  note: string;
};

const nonNegative = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/** Un brouillon incomplet/corrompu ne doit pas bloquer le lecteur. */
export function parseSessionDraft(raw: string | null): SessionDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as SessionDraft;
    if (d.version !== 1 || !/^[dpc]-.+/.test(d.routeId) || !d.resolved?.session?.title ||
      !Array.isArray(d.resolved.session.exercises) || !Array.isArray(d.resolved.notes) ||
      !Array.isArray(d.steps) || !d.steps.length || d.steps.length > 2000 ||
      !Number.isInteger(d.index) || d.index < 0 || d.index >= d.steps.length ||
      !['running', 'done'].includes(d.phase) || !nonNegative(d.elapsedMs) ||
      !(d.remainingMs === null || nonNegative(d.remainingMs)) ||
      !nonNegative(d.draftReps) || !nonNegative(d.draftWeight) ||
      !nonNegative(d.difficulty) || !nonNegative(d.energy) || typeof d.note !== 'string' ||
      !d.results || typeof d.results !== 'object' || Array.isArray(d.results)) return null;
    if (!d.steps.every((s) => s.type === 'rest'
      ? nonNegative(s.seconds) && typeof s.label === 'string'
      : s.type === 'work' && typeof s.exerciseId === 'string' && ['reps', 'time'].includes(s.mode) &&
        ['warmup', 'main', 'cooldown'].includes(s.phase) && nonNegative(s.amount))) return null;
    if (!Object.entries(d.results).every(([key, r]) => Number.isInteger(Number(key)) &&
      Number(key) >= 0 && Number(key) < d.steps.length && r && typeof r === 'object' &&
      [r.reps, r.seconds, r.weightKg].every((n) => n === undefined || nonNegative(n)))) return null;
    return d;
  } catch {
    return null;
  }
}

/** Le temps hors de l'application n'est pas ajouté au temps déjà effectué. */
export function resumeSessionClock(draft: SessionDraft, now: number) {
  return {
    startedAt: now - draft.elapsedMs,
    finishedAt: draft.phase === 'done' ? now : 0,
    pausedLeft: draft.phase === 'running' ? draft.remainingMs : null,
  };
}

