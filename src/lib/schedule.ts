import type { AppData, BodyPart, LogEntry, WorkoutSession } from '@/store/types';

import { addDays, dateKey, weekdayIndex } from './date';
import { adaptSession } from './workout';

export type DayStatus = 'planned' | 'done' | 'skipped' | 'missed' | 'rest';

export type ScheduledDay = {
  date: string;
  status: DayStatus;
  session?: WorkoutSession;
  /** Séance d'origine du programme avant modification. */
  modified: boolean;
  reason?: string;
  /** Remplacements automatiques à cause d'une douleur. */
  adaptations: string[];
  log?: LogEntry;
  movedTo?: string;
};

export function activeAvoid(data: Pick<AppData, 'limitations'>, date: string): BodyPart[] {
  return [...new Set(data.limitations.filter((l) => l.startDate <= date && date <= l.endDate).map((l) => l.bodyPart))];
}

function templateFor(data: AppData, date: string): WorkoutSession | undefined {
  const { plan, profile } = data;
  if (!plan.templates.length || date < plan.startDate) return undefined;
  const days = profile.trainingDays;
  if (!days.includes(weekdayIndex(date))) return undefined;
  // Rotation : nombre de jours d'entraînement entre le début du plan et cette date.
  let count = 0;
  for (let k = plan.startDate; k < date; k = addDays(k, 1)) if (days.includes(weekdayIndex(k))) count++;
  return plan.templates[count % plan.templates.length];
}

export function getDay(data: AppData, date: string): ScheduledDay {
  const log = data.logs.find((l) => l.scheduledDate === date);
  const ov = data.overrides[date];
  let session: WorkoutSession | undefined;
  let modified = false;
  let reason: string | undefined;
  let movedTo: string | undefined;
  let skipped = false;

  if (ov?.kind === 'replace') {
    session = ov.session;
    modified = true;
    reason = ov.reason;
  } else {
    session = templateFor(data, date);
    if (ov?.kind === 'skip') {
      skipped = true;
      reason = ov.reason;
      movedTo = ov.movedTo;
    }
  }

  let adaptations: string[] = [];
  if (session) {
    const res = adaptSession(session, { equipment: data.profile.equipment, avoid: activeAvoid(data, date) });
    session = res.session;
    adaptations = res.changes;
  }

  let status: DayStatus = 'rest';
  if (log) status = 'done';
  else if (skipped && session) status = 'skipped';
  else if (session) status = date < dateKey() ? 'missed' : 'planned';
  return { date, status, session, modified, reason, adaptations, log, movedTo };
}

export function getRange(data: AppData, from: string, days: number) {
  return Array.from({ length: days }, (_, i) => getDay(data, addDays(from, i)));
}

/** Prochaine séance à faire à partir d'aujourd'hui. */
export function nextSession(data: AppData, from = dateKey(), horizon = 14) {
  for (let i = 0; i < horizon; i++) {
    const d = getDay(data, addDays(from, i));
    if (d.status === 'planned') return d;
  }
  return undefined;
}

/** Séances prévues dans la semaine (lundi → dimanche) contenant `date`. */
export function weekDays(data: AppData, date = dateKey()) {
  const monday = addDays(date, -weekdayIndex(date));
  return getRange(data, monday, 7);
}
