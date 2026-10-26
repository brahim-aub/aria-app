import type { AppData, Diet, Profile } from '@/store/types';

import { dateKey } from './date';
import { getRange } from './schedule';
import { estimateKcal } from './workout';

const JOB_FACTOR = { assis: 1.25, debout: 1.45, physique: 1.65 } as const;

export const JOB_LABEL = { assis: 'Plutôt assis (bureau)', debout: 'Souvent debout / en mouvement', physique: 'Travail physique' } as const;

export const DIET_LABEL: Record<Diet, string> = {
  omnivore: 'Je mange de tout',
  vegetarien: 'Végétarien',
  vegan: 'Vegan',
  pescetarien: 'Pescétarien',
  sans_porc: 'Sans porc',
};

/** Métabolisme de base (Mifflin-St Jeor). */
export function bmr(p: Pick<Profile, 'sex' | 'weightKg' | 'heightCm' | 'age'>) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(base + (p.sex === 'homme' ? 5 : p.sex === 'femme' ? -161 : -78));
}

export type EnergyTargets = {
  bmr: number;
  daily: number;
  trainingPerDay: number;
  target: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  weeklyTrainingKcal: number;
};

/** Besoins quotidiens : métabolisme × activité du quotidien + sport programmé sur les 7 prochains jours, ajusté selon l'objectif. */
export function energyTargets(data: AppData): EnergyTargets {
  const p = data.profile;
  const base = bmr(p);
  const daily = base * JOB_FACTOR[p.job];
  const week = getRange(data, dateKey(), 7);
  const weeklyTrainingKcal = week.reduce((sum, d) => sum + (d.session && d.status !== 'skipped' ? estimateKcal(d.session, p.weightKg) : 0), 0);
  const trainingPerDay = weeklyTrainingKcal / 7;
  const maintenance = daily + trainingPerDay;
  const adj = { perte: -0.17, muscle: 0.1, force: 0.07, forme: 0, endurance: 0.03, sante: 0 }[p.goal];
  const target = Math.round(Math.max(base * 1.1, maintenance * (1 + adj)) / 10) * 10;
  const proteinPerKg = { perte: 2, muscle: 1.8, force: 1.8, forme: 1.5, endurance: 1.5, sante: 1.3 }[p.goal];
  const proteinG = Math.round(p.weightKg * proteinPerKg);
  const fatG = Math.round((target * 0.28) / 9);
  const carbsG = Math.max(0, Math.round((target - proteinG * 4 - fatG * 9) / 4));
  return { bmr: base, daily: Math.round(daily), trainingPerDay: Math.round(trainingPerDay), target, proteinG, fatG, carbsG, weeklyTrainingKcal };
}

export function bmi(p: Pick<Profile, 'weightKg' | 'heightCm'>) {
  const m = p.heightCm / 100;
  return m > 0 ? p.weightKg / (m * m) : 0;
}

export type WeightProjection = {
  intake: number;
  maintenance: number;
  /** kcal/jour en plus (+) ou en moins (-) par rapport à ce que le corps dépense. */
  balance: number;
  /** Poids estimé à la fin de chaque semaine (index 0 = aujourd'hui). */
  weeks: number[];
  endKg: number;
  /** Fourchette : le corps s'adapte, les estimations varient d'une personne à l'autre. */
  lowKg: number;
  highKg: number;
  perWeekKg: number;
  warning?: string;
};

/**
 * Projette l'évolution du poids si on mange `intake` kcal par jour pendant `weeks` semaines.
 * Modèle simple : 7 700 kcal ≈ 1 kg, dépense recalculée chaque semaine avec le nouveau poids. C'est une estimation, pas un suivi.
 */
export function projectWeight(data: AppData, intake: number, weeks: number): WeightProjection {
  const t = energyTargets(data);
  const w0 = data.profile.weightKg;
  const maintenance = t.daily + t.trainingPerDay;
  const pts = [w0];
  let w = w0;
  // Chaque kg en moins abaisse le métabolisme de 10 kcal (Mifflin-St Jeor) × l'activité, et le coût du sport suit le poids.
  const perKg = 10 * JOB_FACTOR[data.profile.job] + t.trainingPerDay / w0;
  for (let i = 0; i < weeks; i++) {
    const dep = maintenance + (w - w0) * perKg;
    w += ((intake - dep) * 7) / 7700;
    pts.push(Math.round(w * 10) / 10);
  }
  const delta = w - w0;
  const endKg = Math.round(w * 10) / 10;
  const perWeekKg = Math.round((delta / weeks) * 100) / 100;
  let warning: string | undefined;
  if (intake < t.bmr * 1.1) warning = 'Ce niveau est trop bas : sous ton métabolisme de base, ce n’est pas recommandé.';
  else if (perWeekKg < -0.0075 * w0) warning = 'Perte rapide (plus de 0,75 % du poids par semaine) : surveille ta forme et ta récupération.';
  return {
    intake: Math.round(intake),
    maintenance: Math.round(maintenance),
    balance: Math.round(intake - maintenance),
    weeks: pts,
    endKg,
    lowKg: Math.round((w0 + delta * 0.7) * 10) / 10,
    highKg: Math.round((w0 + delta * 1.3) * 10) / 10,
    perWeekKg,
    warning,
  };
}
