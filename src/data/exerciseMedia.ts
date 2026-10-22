/**
 * Animations ExerciseDB (version gratuite V1, AscendAPI, oss.exercisedb.dev).
 * Seuls les identifiants sont gardés ici : le GIF est chargé en direct à chaque
 * affichage, sans être enregistré sur le téléphone (les conditions d'ExerciseDB
 * interdisent de stocker le contenu). Pour une diffusion commerciale, il faut
 * un abonnement AscendAPI avec une licence écrite.
 *
 * Correspondances vérifiées une à une ; un exercice sans équivalent exact
 * n'a pas d'animation plutôt qu'une animation trompeuse.
 */
const GIF_IDS: Record<string, string> = {
  shadowBoxing: 'hoXt6wv',
  climbers: 'RJgzwny',
  burpees: 'dK9394r',
  squatSaute: 'LIlE5Tn',
  patineur: 'zfNHMN9',
  cordeSauter: 'e1e76I2',
  velo: 'H1PESYI',
  tapis: 'rjiM4L3',
  squat: '75Bgtjy',
  fentes: 'iqH55N8',
  pont: 'u0cNiij',
  pontUnilateral: 'rmEukuS',
  mollets: 'bJYHBIN',
  pompesMur: 'LEH9jxP',
  pompesInclinees: 'B1EVP9F',
  pompesGenoux: 'ZOuKWir',
  pompes: 'I4hDWkc',
  pompesDiamant: 'soIB2rj',
  dipsChaise: 'RrLske5',
  rowingServiette: 'uTv34oq',
  gainageLateral: 'RKjH6Lt',
  deadBug: 'iny3m5y',
  crunch: 'TFqbd8t',
  releveJambes: '9IxJdtC',
  russianTwist: 'XVDdcoj',
  gobletSquat: 'yn8yg1r',
  rdlHalteres: 'rR0LJzx',
  fentesHalteres: 'RRWFUcw',
  developpeHalteres: 'SpYC0Kp',
  rowingHaltere: 'C0MA9bC',
  developpeMilitaire: 'znQUdHY',
  elevationsLaterales: 'DsgkuIt',
  curlHalteres: 'NbVPDMW',
  curlMarteau: '2NpxjC1',
  extensionTriceps: 'kont8Ut',
  tirageElastique: 'Nu7jqFE',
  pallof: '9pa4H5m',
  squatElastique: 'TUZLh71',
  swingKettlebell: 'UHJlbu3',
  gobletKettlebell: 'ZA8b5hc',
  tractions: 'lBDjFxJ',
  squatBarre: 'qXTaZnJ',
  souleveTerre: 'ila4NZS',
  developpeCouche: 'EIeI8Vf',
  rowingBarre: 'eZyBC3j',
  developpeMilitaireBarre: 'wdRZISl',
  hipThrust: 'qg2PGl6',
  presseCuisses: '10Z2DXU',
  legCurl: '17lJ1kr',
  legExtension: 'my33uHU',
  tirageVertical: 'RVwzP10',
  rowingAssis: 'A3P4O0R',
  chestPress: 'DOoWcnA',
  shoulderPressMachine: '67n3r98',
  tricepsPoulie: '3ZflifB',
  mollets_machine: 'ykUOVze',
};

export const EXERCISE_MEDIA_CREDIT = 'Animation : ExerciseDB';

export function exerciseGifUrl(exerciseId: string): string | undefined {
  const id = GIF_IDS[exerciseId];
  return id ? `https://static.exercisedb.dev/media/${id}.gif` : undefined;
}
