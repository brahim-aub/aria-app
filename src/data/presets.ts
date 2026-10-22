import type { Level, SessionExercise, WorkoutSession } from '@/store/types';

import { EXERCISES } from './exercises';

/** [id, séries, reps ou secondes, repos] — reps/secondes selon le mode de l'exercice. */
type Row = [string, number, number, number];

const rows = (list: Row[]): SessionExercise[] =>
  list.map(([exerciseId, sets, amount, restSec]) => {
    const timed = EXERCISES[exerciseId]?.mode === 'time';
    return { exerciseId, sets, restSec, reps: timed ? undefined : amount, seconds: timed ? amount : undefined };
  });

type Preset = WorkoutSession & { level: Level; equipmentTag: 'none' | 'small' | 'gym'; tags: string[] };

const P = (p: Omit<Preset, 'source' | 'warmup' | 'cooldown'> & { warmup?: boolean; cooldown?: boolean }): Preset => ({
  warmup: true,
  cooldown: true,
  source: 'preset',
  ...p,
});

export const PRESETS: Preset[] = [
  // ───────── Sans matériel ─────────
  P({ id: 'p-reveil', title: 'Réveil en douceur', focus: 'Tout le corps, très accessible', level: 'debutant', equipmentTag: 'none', format: 'circuit', tags: ['15 min', 'Reprise'],
    exercises: rows([['squat', 2, 8, 40], ['pompesMur', 2, 8, 40], ['pont', 2, 10, 40], ['birdDog', 2, 8, 40], ['planche', 2, 20, 40]]) }),
  P({ id: 'p-full-debutant', title: 'Full body débutant', focus: 'Tout le corps', level: 'debutant', equipmentTag: 'none', format: 'circuit', tags: ['25 min'],
    exercises: rows([['squat', 3, 10, 35], ['pompesInclinees', 3, 8, 35], ['fentes', 3, 8, 35], ['superman', 3, 10, 35], ['planche', 3, 25, 35], ['montees', 3, 25, 60]]) }),
  P({ id: 'p-express', title: 'Express 10 minutes', focus: 'Cardio + renfo, zéro excuse', level: 'debutant', equipmentTag: 'none', format: 'circuit', tags: ['10 min', 'Rapide'], warmup: false, cooldown: false,
    exercises: rows([['jumping', 3, 30, 15], ['squat', 3, 12, 15], ['pompesGenoux', 3, 8, 15], ['climbers', 3, 25, 15]]) }),
  P({ id: 'p-abdos', title: 'Abdos & gainage', focus: 'Sangle abdominale', level: 'debutant', equipmentTag: 'none', format: 'circuit', tags: ['12 min', 'Core'],
    exercises: rows([['deadBug', 3, 10, 25], ['crunch', 3, 12, 25], ['planche', 3, 30, 25], ['gainageLateral', 3, 30, 25], ['birdDog', 3, 10, 30]]) }),
  P({ id: 'p-cardio-brule', title: 'Cardio brûle-graisses', focus: 'Souffle, dépense calorique', level: 'intermediaire', equipmentTag: 'none', format: 'circuit', tags: ['20 min', 'HIIT'],
    exercises: rows([['jumping', 4, 40, 20], ['squatSaute', 4, 12, 20], ['climbers', 4, 35, 20], ['patineur', 4, 35, 20], ['burpees', 4, 8, 60]]) }),
  P({ id: 'p-jambes-maison', title: 'Jambes & fessiers maison', focus: 'Cuisses, fessiers', level: 'intermediaire', equipmentTag: 'none', format: 'sets', tags: ['25 min'],
    exercises: rows([['squat', 3, 15, 45], ['fenteArriere', 3, 12, 45], ['pontUnilateral', 3, 10, 45], ['stepUp', 3, 10, 45], ['chaise', 2, 45, 45], ['mollets', 3, 20, 30]]) }),
  P({ id: 'p-haut-maison', title: 'Haut du corps maison', focus: 'Pectoraux, épaules, bras, dos', level: 'intermediaire', equipmentTag: 'none', format: 'sets', tags: ['25 min'],
    exercises: rows([['pompes', 4, 10, 60], ['rowingServiette', 4, 12, 60], ['pikePushup', 3, 8, 60], ['dipsChaise', 3, 10, 60], ['nageur', 3, 10, 45], ['planche', 3, 40, 40]]) }),
  P({ id: 'p-athlete', title: 'Athlète au poids du corps', focus: 'Tout le corps, intense', level: 'confirme', equipmentTag: 'none', format: 'circuit', tags: ['30 min', 'Intense'],
    exercises: rows([['burpees', 4, 12, 30], ['squatBulgare', 4, 10, 30], ['pompesDiamant', 4, 12, 30], ['squatSaute', 4, 15, 30], ['hollow', 4, 40, 30], ['pikePushup', 4, 10, 60]]) }),
  P({ id: 'p-mobilite', title: 'Mobilité & dos', focus: 'Souplesse, dos, posture', level: 'debutant', equipmentTag: 'none', format: 'sets', tags: ['10 min', 'Récup'], warmup: false,
    exercises: rows([['chatVache', 2, 45, 15], ['etirementHanches', 2, 60, 15], ['birdDog', 2, 10, 20], ['nageur', 2, 10, 20], ['superman', 2, 10, 20]]) }),

  // ───────── Petit matériel ─────────
  P({ id: 'p-halteres-full', title: 'Full body haltères', focus: 'Tout le corps', level: 'debutant', equipmentTag: 'small', format: 'sets', tags: ['30 min', 'Haltères'],
    exercises: rows([['gobletSquat', 3, 12, 60], ['floorPress', 3, 10, 60], ['rowingHaltere', 3, 10, 60], ['rdlHalteres', 3, 10, 60], ['developpeMilitaire', 2, 10, 60], ['planche', 2, 30, 40]]) }),
  P({ id: 'p-bras', title: 'Bras & épaules', focus: 'Biceps, triceps, épaules', level: 'intermediaire', equipmentTag: 'small', format: 'sets', tags: ['25 min', 'Haltères'],
    exercises: rows([['developpeMilitaire', 3, 10, 60], ['elevationsLaterales', 3, 12, 45], ['curlHalteres', 3, 12, 45], ['extensionTriceps', 3, 12, 45], ['curlMarteau', 3, 10, 45], ['dipsChaise', 2, 12, 45]]) }),
  P({ id: 'p-elastiques', title: 'Renfo élastiques', focus: 'Dos, posture, gainage', level: 'debutant', equipmentTag: 'small', format: 'circuit', tags: ['20 min', 'Élastiques'],
    exercises: rows([['squatElastique', 3, 15, 30], ['tirageElastique', 3, 15, 30], ['facePull', 3, 15, 30], ['pallof', 3, 10, 30], ['pont', 3, 15, 45]]) }),
  P({ id: 'p-kettlebell', title: 'Kettlebell power', focus: 'Chaîne postérieure, cardio', level: 'intermediaire', equipmentTag: 'small', format: 'circuit', tags: ['20 min', 'Kettlebell'],
    exercises: rows([['swingKettlebell', 4, 15, 30], ['gobletKettlebell', 4, 12, 30], ['pompes', 4, 10, 30], ['russianTwist', 4, 20, 45]]) }),

  // ───────── Salle ─────────
  P({ id: 'p-salle-debutant', title: 'Découverte de la salle', focus: 'Machines guidées, tout le corps', level: 'debutant', equipmentTag: 'gym', format: 'sets', tags: ['40 min', 'Salle'],
    exercises: rows([['velo', 1, 300, 30], ['presseCuisses', 3, 12, 75], ['chestPress', 3, 12, 75], ['tirageVertical', 3, 12, 75], ['legCurl', 2, 12, 60], ['rowingAssis', 3, 12, 75], ['planche', 2, 30, 45]]) }),
  P({ id: 'p-push', title: 'Push (salle)', focus: 'Pectoraux, épaules, triceps', level: 'confirme', equipmentTag: 'gym', format: 'sets', tags: ['50 min', 'Salle'],
    exercises: rows([['developpeCouche', 4, 8, 120], ['developpeHalteres', 3, 10, 90], ['developpeMilitaireBarre', 3, 8, 90], ['elevationsLaterales', 3, 15, 45], ['tricepsPoulie', 3, 12, 60]]) }),
  P({ id: 'p-pull', title: 'Pull (salle)', focus: 'Dos, biceps', level: 'confirme', equipmentTag: 'gym', format: 'sets', tags: ['50 min', 'Salle'],
    exercises: rows([['souleveTerre', 4, 5, 150], ['tractions', 4, 6, 120], ['rowingBarre', 3, 8, 90], ['facePull', 3, 15, 45], ['curlHalteres', 3, 10, 60]]) }),
  P({ id: 'p-legs', title: 'Jambes (salle)', focus: 'Quadriceps, ischios, fessiers', level: 'confirme', equipmentTag: 'gym', format: 'sets', tags: ['50 min', 'Salle'],
    exercises: rows([['squatBarre', 4, 8, 150], ['hipThrust', 3, 10, 90], ['presseCuisses', 3, 12, 90], ['legCurl', 3, 12, 60], ['mollets_machine', 4, 15, 45]]) }),
  P({ id: 'p-force-expert', title: 'Force 5×5', focus: 'Les trois gros mouvements', level: 'expert', equipmentTag: 'gym', format: 'sets', tags: ['60 min', 'Force'],
    exercises: rows([['squatBarre', 5, 5, 180], ['developpeCouche', 5, 5, 180], ['rowingBarre', 5, 5, 150]]) }),
];

export function getPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}

export const EQUIPMENT_TAG_LABEL = { none: 'Sans matériel', small: 'Petit matériel', gym: 'Salle de sport' } as const;
