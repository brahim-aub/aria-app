import type { Equipment, Goal } from '@/lib/types';

export const GOAL_LABELS: Record<Goal, string> = {
  perte_poids: 'Perdre du poids',
  muscle: 'Prendre du muscle',
  forme: 'Être en forme',
  souplesse: 'Gagner en souplesse',
  reprise: 'Me remettre au sport',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  tapis: 'Un tapis',
  elastique: 'Un élastique',
  halteres: 'Des haltères',
};

/** Niveau de départ tel que la personne le décrit pendant l'onboarding. */
export const ACTIVITY_LABELS = { 1: 'Pas du tout', 2: 'Un peu', 3: 'Régulièrement' } as const;

export const MINUTE_OPTIONS = [10, 20, 30, 45];
