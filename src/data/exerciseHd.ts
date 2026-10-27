import type { VideoSource } from 'expo-video';

/** Échantillon officiel Vital Animations Free Pack, téléchargé le 27/10/2026.
 * https://vitalanimations.com/free-pack — https://vitalanimations.com/license
 * Les fichiers servent aux démonstrations intégrées ; aucune redistribution du pack brut.
 * Association explicite au mouvement exact, jamais à une simple famille musculaire.
 */
export const EXERCISE_HD: Record<string, { source: VideoSource; provider: string }> = {
  squatBarre: { source: require('../../assets/exercise-hd/0054.mp4'), provider: 'Vital Animations' },
  hipThrust: { source: require('../../assets/exercise-hd/0057.mp4'), provider: 'Vital Animations' },
  gobletSquat: { source: require('../../assets/exercise-hd/0064.mp4'), provider: 'Vital Animations' },
  swingKettlebell: { source: require('../../assets/exercise-hd/0072.mp4'), provider: 'Vital Animations' },
  legExtension: { source: require('../../assets/exercise-hd/0073.mp4'), provider: 'Vital Animations' },
  presseCuisses: { source: require('../../assets/exercise-hd/0074.mp4'), provider: 'Vital Animations' },
  legCurl: { source: require('../../assets/exercise-hd/0075.mp4'), provider: 'Vital Animations' },
  rameur: { source: require('../../assets/exercise-hd/0077.mp4'), provider: 'Vital Animations' },
  tricepsPoulie: { source: require('../../assets/exercise-hd/0085.mp4'), provider: 'Vital Animations' },
  tapis: { source: require('../../assets/exercise-hd/0086.mp4'), provider: 'Vital Animations' },
  developpeMilitaireBarre: { source: require('../../assets/exercise-hd/0088.mp4'), provider: 'Vital Animations' },
  developpeMilitaire: { source: require('../../assets/exercise-hd/0090.mp4'), provider: 'Vital Animations' },
  elevationsLaterales: { source: require('../../assets/exercise-hd/0096.mp4'), provider: 'Vital Animations' },
};
