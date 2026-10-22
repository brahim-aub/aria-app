import type { IconName } from '@/components/ui';
import type { Stats } from '@/lib/stats';

export type Tier = 'bronze' | 'argent' | 'or' | 'legende';

export type Achievement = {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  tier: Tier;
  category: 'Assiduité' | 'Endurance' | 'Force' | 'Régularité' | 'Explorateur' | 'Coach & nutrition' | 'Secrets';
  stat: keyof Stats;
  target: number;
  /** Caché tant qu'il n'est pas débloqué. */
  secret?: boolean;
};

export const TIER_POINTS: Record<Tier, number> = { bronze: 10, argent: 20, or: 40, legende: 80 };
/** Teintes foncées : lisibles en texte sur fond clair (≥ 4,5:1). */
export const TIER_COLOR: Record<Tier, string> = { bronze: '#9A5524', argent: '#566271', or: '#8F6200', legende: '#6447D1' };
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Bronze', argent: 'Argent', or: 'Or', legende: 'Légendaire' };

const A = (a: Achievement) => a;

export const ACHIEVEMENTS: Achievement[] = [
  // Assiduité
  A({ id: 's1', title: 'Premier pas', description: 'Termine ta première séance', icon: 'footsteps', tier: 'bronze', category: 'Assiduité', stat: 'sessions', target: 1 }),
  A({ id: 's5', title: 'Ça devient une habitude', description: 'Termine 5 séances', icon: 'flame', tier: 'bronze', category: 'Assiduité', stat: 'sessions', target: 5 }),
  A({ id: 's10', title: 'Dix sur dix', description: 'Termine 10 séances', icon: 'flame', tier: 'argent', category: 'Assiduité', stat: 'sessions', target: 10 }),
  A({ id: 's25', title: 'Quart de centurion', description: 'Termine 25 séances', icon: 'medal', tier: 'argent', category: 'Assiduité', stat: 'sessions', target: 25 }),
  A({ id: 's50', title: 'Machine de guerre', description: 'Termine 50 séances', icon: 'medal', tier: 'or', category: 'Assiduité', stat: 'sessions', target: 50 }),
  A({ id: 's100', title: 'Centurion', description: 'Termine 100 séances', icon: 'trophy', tier: 'legende', category: 'Assiduité', stat: 'sessions', target: 100 }),

  // Endurance (temps)
  A({ id: 'm60', title: 'Première heure', description: 'Cumule 1 heure de sport', icon: 'time', tier: 'bronze', category: 'Endurance', stat: 'minutes', target: 60 }),
  A({ id: 'm600', title: 'Dix heures de sueur', description: 'Cumule 10 heures de sport', icon: 'time', tier: 'argent', category: 'Endurance', stat: 'minutes', target: 600 }),
  A({ id: 'm1800', title: 'Pilier de la salle', description: 'Cumule plus de 30 heures de sport', icon: 'hourglass', tier: 'or', category: 'Endurance', stat: 'minutes', target: 1800 }),
  A({ id: 'm6000', title: 'Cent heures', description: 'Cumule 100 heures de sport', icon: 'hourglass', tier: 'legende', category: 'Endurance', stat: 'minutes', target: 6000 }),
  A({ id: 'k1000', title: 'Fournaise', description: 'Brûle 1 000 kcal à l’entraînement', icon: 'bonfire', tier: 'bronze', category: 'Endurance', stat: 'kcal', target: 1000 }),
  A({ id: 'k10000', title: 'Haut fourneau', description: 'Brûle 10 000 kcal à l’entraînement', icon: 'bonfire', tier: 'or', category: 'Endurance', stat: 'kcal', target: 10000 }),

  // Force
  A({ id: 'v100', title: 'Cent kilos', description: 'Soulève 100 kg au total', icon: 'barbell', tier: 'bronze', category: 'Force', stat: 'volumeKg', target: 100 }),
  A({ id: 'v1000', title: 'Une tonne', description: 'Soulève 1 000 kg au total', icon: 'barbell', tier: 'argent', category: 'Force', stat: 'volumeKg', target: 1000 }),
  A({ id: 'v10000', title: 'Déménageur', description: 'Soulève 10 tonnes au total', icon: 'barbell', tier: 'or', category: 'Force', stat: 'volumeKg', target: 10000 }),
  A({ id: 'v100000', title: 'Titan', description: 'Soulève 100 tonnes au total', icon: 'planet', tier: 'legende', category: 'Force', stat: 'volumeKg', target: 100000 }),
  A({ id: 'vs2000', title: 'Grosse séance', description: 'Soulève 2 tonnes en une seule séance', icon: 'rocket', tier: 'or', category: 'Force', stat: 'bestSessionVolume', target: 2000 }),
  A({ id: 'r1000', title: 'Mille répétitions', description: 'Cumule 1 000 répétitions', icon: 'repeat', tier: 'argent', category: 'Force', stat: 'reps', target: 1000 }),
  A({ id: 'r10000', title: 'Infatigable', description: 'Cumule 10 000 répétitions', icon: 'repeat', tier: 'or', category: 'Force', stat: 'reps', target: 10000 }),

  // Régularité
  A({ id: 'w1', title: 'Semaine parfaite', description: 'Atteins ton objectif de la semaine', icon: 'checkmark-done', tier: 'bronze', category: 'Régularité', stat: 'bestWeekStreak', target: 1 }),
  A({ id: 'w4', title: 'Un mois solide', description: '4 semaines d’affilée à l’objectif', icon: 'calendar', tier: 'argent', category: 'Régularité', stat: 'bestWeekStreak', target: 4 }),
  A({ id: 'w12', title: 'Trimestre de fer', description: '12 semaines d’affilée à l’objectif', icon: 'calendar', tier: 'or', category: 'Régularité', stat: 'bestWeekStreak', target: 12 }),
  A({ id: 'w52', title: 'Une année entière', description: '52 semaines d’affilée à l’objectif', icon: 'infinite', tier: 'legende', category: 'Régularité', stat: 'bestWeekStreak', target: 52 }),
  A({ id: 'd3', title: 'Trois jours de suite', description: 'Fais du sport 3 jours d’affilée', icon: 'trending-up', tier: 'bronze', category: 'Régularité', stat: 'bestDayStreak', target: 3 }),
  A({ id: 'd7', title: 'Semaine non-stop', description: 'Fais du sport 7 jours d’affilée', icon: 'trending-up', tier: 'or', category: 'Régularité', stat: 'bestDayStreak', target: 7 }),

  // Explorateur
  A({ id: 'x10', title: 'Curieux', description: 'Essaie 10 exercices différents', icon: 'compass', tier: 'bronze', category: 'Explorateur', stat: 'distinctExercises', target: 10 }),
  A({ id: 'x25', title: 'Touche-à-tout', description: 'Essaie 25 exercices différents', icon: 'compass', tier: 'argent', category: 'Explorateur', stat: 'distinctExercises', target: 25 }),
  A({ id: 'x50', title: 'Encyclopédie vivante', description: 'Essaie 50 exercices différents', icon: 'library', tier: 'or', category: 'Explorateur', stat: 'distinctExercises', target: 50 }),
  A({ id: 'c1', title: 'Architecte', description: 'Crée ta propre séance', icon: 'construct', tier: 'bronze', category: 'Explorateur', stat: 'custom', target: 1 }),
  A({ id: 'c5', title: 'Maître d’œuvre', description: 'Crée 5 séances personnalisées', icon: 'construct', tier: 'argent', category: 'Explorateur', stat: 'custom', target: 5 }),

  // Coach & nutrition
  A({ id: 'chat1', title: 'Bonjour coach', description: 'Envoie ton premier message au coach', icon: 'chatbubbles', tier: 'bronze', category: 'Coach & nutrition', stat: 'chat', target: 1 }),
  A({ id: 'chat50', title: 'Bavard', description: 'Échange 50 messages avec le coach', icon: 'chatbubbles', tier: 'argent', category: 'Coach & nutrition', stat: 'chat', target: 50 }),
  A({ id: 'ai1', title: 'Sur mesure', description: 'Laisse le coach adapter ton programme', icon: 'color-wand', tier: 'bronze', category: 'Coach & nutrition', stat: 'aiAdaptations', target: 1 }),
  A({ id: 'ai10', title: 'Programme vivant', description: 'Le coach a adapté ton programme 10 fois', icon: 'color-wand', tier: 'argent', category: 'Coach & nutrition', stat: 'aiAdaptations', target: 10 }),
  A({ id: 'meal1', title: 'À table !', description: 'Génère ton premier plan de repas', icon: 'restaurant', tier: 'bronze', category: 'Coach & nutrition', stat: 'mealPlans', target: 1 }),
  A({ id: 'wt5', title: 'Suivi rigoureux', description: 'Note ton poids 5 fois', icon: 'scale', tier: 'bronze', category: 'Coach & nutrition', stat: 'weights', target: 5 }),
  A({ id: 'wl5', title: 'Moins 5', description: 'Perds 5 kg depuis ta première pesée', icon: 'trending-down', tier: 'or', category: 'Coach & nutrition', stat: 'weightLostKg', target: 5 }),

  // Secrets
  A({ id: 'early', title: 'Lève-tôt', description: 'Termine une séance avant 8 h', icon: 'sunny', tier: 'argent', category: 'Secrets', stat: 'earlyBird', target: 1, secret: true }),
  A({ id: 'night', title: 'Oiseau de nuit', description: 'Termine une séance après 21 h', icon: 'moon', tier: 'argent', category: 'Secrets', stat: 'nightOwl', target: 1, secret: true }),
  A({ id: 'weekend', title: 'Guerrier du week-end', description: '10 séances le week-end', icon: 'beer', tier: 'argent', category: 'Secrets', stat: 'weekend', target: 10, secret: true }),
  A({ id: 'hard', title: 'Jusqu’au bout', description: 'Termine 3 séances notées « très dur »', icon: 'skull', tier: 'or', category: 'Secrets', stat: 'hardSessions', target: 3, secret: true }),
  A({ id: 'body', title: 'À l’écoute de ton corps', description: 'Signale une douleur au coach pour adapter tes séances', icon: 'heart', tier: 'bronze', category: 'Secrets', stat: 'limitations', target: 1, secret: true }),
];

export function progressOf(a: Achievement, s: Stats) {
  const value = Number(s[a.stat]) || 0;
  return { value, ratio: Math.min(1, value / a.target), done: value >= a.target };
}

/** Points et niveau façon jeu de rôle. */
export function levelFromPoints(points: number) {
  // Chaque niveau demande 10 points de plus que le précédent : 30, 40, 50…
  let level = 1;
  let need = 30;
  let rest = points;
  while (rest >= need) {
    rest -= need;
    level++;
    need += 10;
  }
  return { level, into: rest, need };
}

export const LEVEL_TITLES = ['Recrue', 'Apprenti', 'Sportif', 'Athlète', 'Champion', 'Héros', 'Légende', 'Mythe'];
export const levelTitle = (level: number) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.floor((level - 1) / 3))];

/** Points d'expérience : succès débloqués + 5 points par séance. */
export function totalPoints(unlocked: Record<string, string>, sessions: number) {
  return ACHIEVEMENTS.reduce((s, a) => s + (unlocked[a.id] ? TIER_POINTS[a.tier] : 0), 0) + sessions * 5;
}
