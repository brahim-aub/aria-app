import type { AppData, LogEntry } from '@/store/types';

import { dateKey, startOfWeek, weekKey } from './date';

export function countByWeek(logs: LogEntry[]) {
  const map = new Map<string, { count: number; minutes: number }>();
  for (const l of logs) {
    const k = weekKey(new Date(l.date));
    const cur = map.get(k) ?? { count: 0, minutes: 0 };
    map.set(k, { count: cur.count + 1, minutes: cur.minutes + l.durationMin });
  }
  return map;
}

export function sessionsThisWeek(logs: LogEntry[]) {
  const start = startOfWeek(new Date()).getTime();
  return logs.filter((l) => new Date(l.date).getTime() >= start).length;
}

/** Nombre de semaines consécutives où l'objectif hebdo est atteint (la semaine en cours compte si déjà atteinte). */
export function weekStreak(logs: LogEntry[], goal: number) {
  const byWeek = countByWeek(logs);
  const cursor = startOfWeek(new Date());
  let streak = 0;
  if ((byWeek.get(weekKey(cursor))?.count ?? 0) >= goal) streak++;
  for (;;) {
    cursor.setDate(cursor.getDate() - 7);
    if ((byWeek.get(weekKey(cursor))?.count ?? 0) >= goal) streak++;
    else break;
  }
  return streak;
}

function bestWeekStreak(logs: LogEntry[], goal: number) {
  const byWeek = countByWeek(logs);
  if (!logs.length) return 0;
  const first = startOfWeek(new Date(logs[logs.length - 1].date));
  const end = startOfWeek(new Date()).getTime();
  let best = 0;
  let cur = 0;
  for (const c = new Date(first); c.getTime() <= end; c.setDate(c.getDate() + 7)) {
    if ((byWeek.get(weekKey(c))?.count ?? 0) >= goal) best = Math.max(best, ++cur);
    else cur = 0;
  }
  return best;
}

function bestDayStreak(logs: LogEntry[]) {
  const days = [...new Set(logs.map((l) => dateKey(new Date(l.date))))].sort();
  let best = 0;
  let cur = 0;
  let prev: Date | null = null;
  for (const k of days) {
    const d = new Date(k + 'T12:00:00');
    cur = prev && Math.round((d.getTime() - prev.getTime()) / 86400000) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

export type Stats = {
  sessions: number;
  minutes: number;
  volumeKg: number;
  kcal: number;
  reps: number;
  bestSessionVolume: number;
  weekStreak: number;
  bestWeekStreak: number;
  bestDayStreak: number;
  distinctExercises: number;
  earlyBird: number;
  nightOwl: number;
  weekend: number;
  hardSessions: number;
  weights: number;
  chat: number;
  aiAdaptations: number;
  custom: number;
  mealPlans: number;
  limitations: number;
  weightLostKg: number;
};

export function computeStats(data: AppData): Stats {
  const logs = data.logs;
  const goal = Math.max(1, data.profile.sessionsPerWeek);
  const exercises = new Set<string>();
  let reps = 0;
  for (const l of logs) for (const e of l.exercises ?? []) {
    exercises.add(e.exerciseId);
    for (const s of e.sets) reps += s.reps ?? 0;
  }
  const hours = logs.map((l) => new Date(l.date).getHours());
  const sortedW = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  return {
    sessions: logs.length,
    minutes: logs.reduce((s, l) => s + l.durationMin, 0),
    volumeKg: Math.round(logs.reduce((s, l) => s + (l.volumeKg ?? 0), 0)),
    kcal: logs.reduce((s, l) => s + (l.kcal ?? 0), 0),
    reps,
    bestSessionVolume: Math.max(0, ...logs.map((l) => l.volumeKg ?? 0)),
    weekStreak: weekStreak(logs, goal),
    bestWeekStreak: bestWeekStreak(logs, goal),
    bestDayStreak: bestDayStreak(logs),
    distinctExercises: exercises.size,
    earlyBird: hours.filter((h) => h < 8).length,
    nightOwl: hours.filter((h) => h >= 21).length,
    weekend: logs.filter((l) => [0, 6].includes(new Date(l.date).getDay())).length,
    hardSessions: logs.filter((l) => l.difficulty >= 5).length,
    weights: data.weights.length,
    chat: data.counters.chatMessages,
    aiAdaptations: data.counters.aiAdaptations,
    custom: data.counters.customCreated,
    mealPlans: data.counters.mealPlans,
    limitations: data.limitations.length,
    weightLostKg: sortedW.length >= 2 ? Math.max(0, sortedW[0].kg - sortedW[sortedW.length - 1].kg) : 0,
  };
}
