import type { BodyPart, Equipment, Muscle } from '@/store/types';

export type ExerciseCategory = 'warmup' | 'strength' | 'cardio' | 'core' | 'mobility';

export type Exercise = {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscles: Muscle[];
  /** Matériel nécessaire (tout doit être disponible). Vide = poids du corps. */
  equipment: Equipment[];
  /** 1 = débutant, 2 = intermédiaire, 3 = confirmé */
  level: 1 | 2 | 3;
  mode: 'reps' | 'time';
  /** Articulations sollicitées : l'exercice est évité en cas de douleur à cet endroit. */
  stresses: BodyPart[];
  cues: string[];
  easier?: string;
  /** Dépense énergétique (MET) pendant l'effort. */
  met: number;
  /** Exercice chargé : on note le poids soulevé. */
  loaded?: boolean;
};

const E = (e: Exercise) => e;

const LIST: Exercise[] = [
  // ───────── Échauffement / retour au calme ─────────
  E({ id: 'marche', name: 'Marche sur place active', category: 'warmup', muscles: ['cardio'], equipment: [], level: 1, mode: 'time', stresses: [], met: 3.5,
    cues: ['Lève les genoux à hauteur de hanches', 'Balance les bras', 'Respire calmement'] }),
  E({ id: 'rotations', name: 'Rotations articulaires', category: 'warmup', muscles: ['mobilite'], equipment: [], level: 1, mode: 'time', stresses: [], met: 2.5,
    cues: ['Cercles de bras, épaules, hanches, chevilles', '5 à 10 cercles par articulation', 'Mouvements lents et amples'] }),
  E({ id: 'etirements', name: 'Étirements doux', category: 'mobility', muscles: ['mobilite'], equipment: [], level: 1, mode: 'time', stresses: [], met: 2.3,
    cues: ['Cuisses, mollets, épaules, dos', '20 à 30 s par position', 'Respire profondément, sans forcer'] }),
  E({ id: 'chatVache', name: 'Chat-vache', category: 'mobility', muscles: ['mobilite', 'dos'], equipment: [], level: 1, mode: 'time', stresses: ['poignet'], met: 2.3,
    cues: ['À quatre pattes', 'Arrondis le dos en expirant', 'Creuse doucement en inspirant'], easier: 'Sur les avant-bras' }),
  E({ id: 'etirementHanches', name: 'Ouverture des hanches', category: 'mobility', muscles: ['mobilite', 'fessiers'], equipment: [], level: 1, mode: 'time', stresses: ['genou'], met: 2.3,
    cues: ['Fente basse, genou arrière au sol', 'Pousse doucement le bassin vers l’avant', 'Change de côté à mi-temps'] }),

  // ───────── Cardio poids du corps ─────────
  E({ id: 'jumping', name: 'Jumping jacks', category: 'cardio', muscles: ['cardio'], equipment: [], level: 1, mode: 'time', stresses: ['genou', 'cheville'], met: 8,
    cues: ['Écarte bras et jambes en sautant', 'Atterris sur l’avant des pieds', 'Garde un rythme régulier'], easier: 'Sans sauter : écarte une jambe après l’autre' }),
  E({ id: 'montees', name: 'Montées de genoux', category: 'cardio', muscles: ['cardio', 'quadriceps'], equipment: [], level: 1, mode: 'time', stresses: ['genou', 'cheville'], met: 8,
    cues: ['Monte les genoux vers la poitrine', 'Reste sur l’avant des pieds', 'Garde le buste droit'], easier: 'En marchant, sans courir' }),
  E({ id: 'talonsFesses', name: 'Talons-fesses', category: 'cardio', muscles: ['cardio', 'ischios'], equipment: [], level: 1, mode: 'time', stresses: ['genou', 'cheville'], met: 7,
    cues: ['Ramène les talons vers les fesses', 'Petits appuis rapides', 'Bras actifs'], easier: 'En marchant' }),
  E({ id: 'shadowBoxing', name: 'Shadow boxing', category: 'cardio', muscles: ['cardio', 'epaules'], equipment: [], level: 1, mode: 'time', stresses: ['epaule'], met: 6,
    cues: ['Garde haute, genoux souples', 'Enchaîne directs et crochets dans le vide', 'Expire à chaque coup'] }),
  E({ id: 'climbers', name: 'Mountain climbers', category: 'cardio', muscles: ['cardio', 'abdos'], equipment: [], level: 2, mode: 'time', stresses: ['poignet', 'epaule'], met: 8,
    cues: ['Position de pompe, bras tendus', 'Ramène un genou puis l’autre vers la poitrine', 'Hanches basses'], easier: 'Mains sur un canapé, mouvement lent' }),
  E({ id: 'burpees', name: 'Burpees', category: 'cardio', muscles: ['cardio', 'pectoraux', 'quadriceps'], equipment: [], level: 3, mode: 'reps', stresses: ['poignet', 'epaule', 'genou', 'cheville', 'dos'], met: 10,
    cues: ['Squat, mains au sol, jambes en arrière', 'Reviens pieds sous les hanches', 'Saute bras en l’air'], easier: 'Sans saut ni pompe, en reculant une jambe après l’autre' }),
  E({ id: 'squatSaute', name: 'Squats sautés', category: 'cardio', muscles: ['cardio', 'quadriceps', 'fessiers'], equipment: [], level: 2, mode: 'reps', stresses: ['genou', 'cheville', 'hanche'], met: 9,
    cues: ['Descends en squat', 'Explose vers le haut', 'Réception souple, genoux dans l’axe'], easier: 'Squat normal en montant sur la pointe des pieds' }),
  E({ id: 'patineur', name: 'Sauts du patineur', category: 'cardio', muscles: ['cardio', 'fessiers'], equipment: [], level: 2, mode: 'time', stresses: ['genou', 'cheville'], met: 8,
    cues: ['Saute latéralement d’un pied sur l’autre', 'Jambe arrière croisée derrière', 'Contrôle l’atterrissage'], easier: 'Pas chassés sans sauter' }),
  E({ id: 'cordeSauter', name: 'Corde à sauter', category: 'cardio', muscles: ['cardio', 'mollets'], equipment: [], level: 2, mode: 'time', stresses: ['cheville', 'genou', 'poignet'], met: 11,
    cues: ['Petits sauts sur l’avant des pieds', 'Les poignets font tourner la corde', 'Sans corde : mime le geste'], easier: 'Alterne 20 s de sauts et 10 s de marche' }),

  // ───────── Cardio machines ─────────
  E({ id: 'velo', name: 'Vélo d’appartement', category: 'cardio', muscles: ['cardio', 'quadriceps'], equipment: ['machines'], level: 1, mode: 'time', stresses: [], met: 7,
    cues: ['Selle à hauteur de hanche', 'Jambe presque tendue en bas', 'Rythme où tu peux encore parler'] }),
  E({ id: 'rameur', name: 'Rameur', category: 'cardio', muscles: ['cardio', 'dos'], equipment: ['machines'], level: 1, mode: 'time', stresses: ['dos'], met: 7,
    cues: ['Pousse avec les jambes d’abord', 'Puis tire les coudes vers l’arrière', 'Dos droit, retour contrôlé'] }),
  E({ id: 'tapis', name: 'Tapis de course (marche inclinée)', category: 'cardio', muscles: ['cardio', 'fessiers'], equipment: ['machines'], level: 1, mode: 'time', stresses: ['cheville'], met: 6,
    cues: ['Inclinaison 8 à 12 %', 'Vitesse de marche rapide', 'Ne te tiens pas aux poignées'] }),

  // ───────── Bas du corps poids du corps ─────────
  E({ id: 'squat', name: 'Squat', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: [], level: 1, mode: 'reps', stresses: ['genou', 'hanche'], met: 5,
    cues: ['Pieds largeur d’épaules', 'Descends comme pour t’asseoir', 'Genoux dans l’axe des pieds, dos droit'], easier: 'Descends jusqu’à toucher une chaise derrière toi' }),
  E({ id: 'fentes', name: 'Fentes alternées', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: [], level: 1, mode: 'reps', stresses: ['genou', 'hanche'], met: 5,
    cues: ['Grand pas en avant', 'Le genou arrière descend vers le sol', 'Buste droit, pousse sur le talon avant'], easier: 'Tiens-toi à un mur ou une chaise' }),
  E({ id: 'fenteArriere', name: 'Fentes arrière', category: 'strength', muscles: ['fessiers', 'quadriceps'], equipment: [], level: 1, mode: 'reps', stresses: ['genou', 'hanche'], met: 5,
    cues: ['Recule d’un grand pas', 'Genou arrière vers le sol', 'Pousse sur le pied avant pour remonter'], easier: 'Amplitude réduite, une main sur un mur' }),
  E({ id: 'chaise', name: 'La chaise', category: 'strength', muscles: ['quadriceps'], equipment: [], level: 1, mode: 'time', stresses: ['genou'], met: 4,
    cues: ['Dos contre un mur', 'Cuisses parallèles au sol', 'Genoux au-dessus des chevilles'], easier: 'Descends moins bas' }),
  E({ id: 'pont', name: 'Pont fessier', category: 'strength', muscles: ['fessiers', 'ischios'], equipment: [], level: 1, mode: 'reps', stresses: [], met: 3.5,
    cues: ['Allongé sur le dos, pieds à plat', 'Pousse les hanches vers le plafond', 'Serre les fessiers 1 seconde en haut'] }),
  E({ id: 'pontUnilateral', name: 'Pont fessier sur une jambe', category: 'strength', muscles: ['fessiers', 'ischios'], equipment: [], level: 2, mode: 'reps', stresses: ['hanche'], met: 4,
    cues: ['Une jambe tendue en l’air', 'Pousse sur le talon au sol', 'Bassin bien horizontal'], easier: 'Pont fessier classique' }),
  E({ id: 'mollets', name: 'Montées sur la pointe des pieds', category: 'strength', muscles: ['mollets'], equipment: [], level: 1, mode: 'reps', stresses: ['cheville'], met: 3,
    cues: ['Monte le plus haut possible', 'Marque une pause en haut', 'Redescends lentement'] }),
  E({ id: 'stepUp', name: 'Montées sur chaise', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: [], level: 2, mode: 'reps', stresses: ['genou', 'cheville'], met: 6,
    cues: ['Chaise stable contre un mur', 'Monte en poussant sur le talon', 'Redescends en contrôlant'], easier: 'Utilise une marche d’escalier' }),
  E({ id: 'squatBulgare', name: 'Squat bulgare', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: [], level: 3, mode: 'reps', stresses: ['genou', 'hanche'], met: 6,
    cues: ['Pied arrière posé sur une chaise', 'Descends droit, genou avant stable', 'Pousse sur le talon avant'], easier: 'Fentes arrière' }),
  E({ id: 'goodMorning', name: 'Good morning au poids du corps', category: 'strength', muscles: ['ischios', 'fessiers'], equipment: [], level: 1, mode: 'reps', stresses: ['dos'], met: 3.5,
    cues: ['Mains derrière la tête, genoux souples', 'Penche le buste en reculant les fesses', 'Dos plat tout du long'] }),

  // ───────── Haut du corps poids du corps ─────────
  E({ id: 'pompesMur', name: 'Pompes contre un mur', category: 'strength', muscles: ['pectoraux', 'triceps'], equipment: [], level: 1, mode: 'reps', stresses: ['poignet'], met: 3.5,
    cues: ['Mains sur le mur à hauteur d’épaules', 'Corps aligné', 'Approche la poitrine du mur'] }),
  E({ id: 'pompesInclinees', name: 'Pompes inclinées', category: 'strength', muscles: ['pectoraux', 'triceps'], equipment: [], level: 1, mode: 'reps', stresses: ['poignet', 'epaule'], met: 4,
    cues: ['Mains sur une table ou le bord du canapé', 'Corps gainé, aligné de la tête aux pieds', 'Descends la poitrine vers le support'], easier: 'Mains contre un mur' }),
  E({ id: 'pompesGenoux', name: 'Pompes sur les genoux', category: 'strength', muscles: ['pectoraux', 'triceps'], equipment: [], level: 1, mode: 'reps', stresses: ['poignet', 'epaule'], met: 4,
    cues: ['Genoux au sol, hanches alignées', 'Mains un peu plus larges que les épaules', 'Coudes à 45° du corps'], easier: 'Reviens aux pompes inclinées' }),
  E({ id: 'pompes', name: 'Pompes', category: 'strength', muscles: ['pectoraux', 'triceps', 'epaules'], equipment: [], level: 2, mode: 'reps', stresses: ['poignet', 'epaule', 'coude'], met: 5,
    cues: ['Corps gainé comme une planche', 'Poitrine jusqu’à frôler le sol', 'Coudes à 45°'], easier: 'Pompes sur les genoux' }),
  E({ id: 'pompesDiamant', name: 'Pompes serrées', category: 'strength', muscles: ['triceps', 'pectoraux'], equipment: [], level: 3, mode: 'reps', stresses: ['poignet', 'coude', 'epaule'], met: 5,
    cues: ['Mains rapprochées sous la poitrine', 'Coudes le long du corps', 'Descente lente'], easier: 'Sur les genoux' }),
  E({ id: 'pikePushup', name: 'Pompes piquées (pike)', category: 'strength', muscles: ['epaules', 'triceps'], equipment: [], level: 2, mode: 'reps', stresses: ['poignet', 'epaule', 'nuque'], met: 5,
    cues: ['Fesses en l’air, corps en V inversé', 'Descends le haut du crâne vers le sol', 'Pousse fort sur les mains'], easier: 'Pieds plus proches des mains, amplitude réduite' }),
  E({ id: 'dipsChaise', name: 'Dips sur chaise', category: 'strength', muscles: ['triceps'], equipment: [], level: 2, mode: 'reps', stresses: ['poignet', 'epaule', 'coude'], met: 4,
    cues: ['Mains sur le bord d’une chaise stable', 'Plie les coudes vers l’arrière', 'Épaules basses, loin des oreilles'], easier: 'Genoux pliés, pieds proches' }),
  E({ id: 'superman', name: 'Superman', category: 'strength', muscles: ['dos', 'fessiers'], equipment: [], level: 1, mode: 'reps', stresses: [], met: 3,
    cues: ['Allongé sur le ventre', 'Décolle bras et jambes doucement', 'Regard vers le sol, nuque neutre'] }),
  E({ id: 'nageur', name: 'Y-T-W au sol', category: 'strength', muscles: ['dos', 'epaules'], equipment: [], level: 1, mode: 'reps', stresses: ['epaule'], met: 3,
    cues: ['Allongé sur le ventre, front au sol', 'Décolle les bras en Y, puis T, puis W', 'Serre les omoplates'] }),
  E({ id: 'rowingServiette', name: 'Rowing avec serviette', category: 'strength', muscles: ['dos', 'biceps'], equipment: [], level: 1, mode: 'reps', stresses: ['poignet'], met: 3.5,
    cues: ['Serviette autour d’un poteau ou d’une poignée solide', 'Penche-toi en arrière, bras tendus', 'Tire la poitrine vers tes mains'], easier: 'Pieds plus loin, corps plus droit' }),

  // ───────── Gainage / abdos ─────────
  E({ id: 'planche', name: 'Gainage planche', category: 'core', muscles: ['abdos'], equipment: [], level: 1, mode: 'time', stresses: ['epaule'], met: 3.5,
    cues: ['En appui sur les avant-bras', 'Corps bien droit, ne creuse pas le dos', 'Rentre le nombril, respire'], easier: 'Genoux au sol' }),
  E({ id: 'gainageLateral', name: 'Gainage latéral', category: 'core', muscles: ['abdos'], equipment: [], level: 1, mode: 'time', stresses: ['epaule'], met: 3.5,
    cues: ['Sur un avant-bras, corps de profil', 'Hanches hautes', 'Change de côté à mi-temps'], easier: 'Genou du bas au sol' }),
  E({ id: 'deadBug', name: 'Dead bug', category: 'core', muscles: ['abdos'], equipment: [], level: 1, mode: 'reps', stresses: [], met: 3,
    cues: ['Sur le dos, bras tendus vers le plafond', 'Tends bras et jambe opposés', 'Bas du dos collé au sol'] }),
  E({ id: 'birdDog', name: 'Bird dog', category: 'core', muscles: ['abdos', 'dos'], equipment: [], level: 1, mode: 'reps', stresses: ['poignet', 'genou'], met: 3,
    cues: ['À quatre pattes', 'Tends un bras et la jambe opposée', 'Bassin stable, pas de rotation'] }),
  E({ id: 'crunch', name: 'Crunch', category: 'core', muscles: ['abdos'], equipment: [], level: 1, mode: 'reps', stresses: ['nuque'], met: 3,
    cues: ['Sur le dos, genoux pliés', 'Enroule le haut du dos', 'Ne tire pas sur la nuque'] }),
  E({ id: 'releveJambes', name: 'Relevés de jambes', category: 'core', muscles: ['abdos'], equipment: [], level: 2, mode: 'reps', stresses: ['dos'], met: 3.5,
    cues: ['Sur le dos, mains sous les fesses', 'Monte les jambes tendues', 'Redescends sans toucher le sol'], easier: 'Genoux pliés' }),
  E({ id: 'russianTwist', name: 'Russian twist', category: 'core', muscles: ['abdos'], equipment: [], level: 2, mode: 'reps', stresses: ['dos'], met: 3.5,
    cues: ['Assis, buste incliné en arrière', 'Tourne les épaules d’un côté à l’autre', 'Pieds au sol si besoin'] }),
  E({ id: 'hollow', name: 'Hollow hold', category: 'core', muscles: ['abdos'], equipment: [], level: 3, mode: 'time', stresses: ['dos'], met: 3.5,
    cues: ['Sur le dos, bras et jambes tendus décollés', 'Bas du dos plaqué au sol', 'Respire sans relâcher'], easier: 'Genoux pliés, bras le long du corps' }),

  // ───────── Haltères ─────────
  E({ id: 'gobletSquat', name: 'Goblet squat', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['genou', 'hanche'], met: 5.5, loaded: true,
    cues: ['Haltère tenu contre la poitrine', 'Coudes entre les genoux en bas', 'Dos droit, talons au sol'] }),
  E({ id: 'rdlHalteres', name: 'Soulevé de terre jambes tendues (haltères)', category: 'strength', muscles: ['ischios', 'fessiers', 'dos'], equipment: ['dumbbells'], level: 2, mode: 'reps', stresses: ['dos'], met: 5, loaded: true,
    cues: ['Genoux légèrement fléchis', 'Recule les fesses, haltères le long des jambes', 'Dos plat, remonte en serrant les fessiers'] }),
  E({ id: 'fentesHalteres', name: 'Fentes avec haltères', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: ['dumbbells'], level: 2, mode: 'reps', stresses: ['genou', 'hanche'], met: 6, loaded: true,
    cues: ['Un haltère dans chaque main', 'Grand pas, genou arrière vers le sol', 'Buste droit'] }),
  E({ id: 'floorPress', name: 'Développé au sol (haltères)', category: 'strength', muscles: ['pectoraux', 'triceps'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['poignet', 'epaule'], met: 4.5, loaded: true,
    cues: ['Allongé, genoux pliés', 'Pousse les haltères vers le plafond', 'Les coudes touchent le sol en bas'] }),
  E({ id: 'developpeHalteres', name: 'Développé couché haltères', category: 'strength', muscles: ['pectoraux', 'triceps', 'epaules'], equipment: ['dumbbells', 'bench'], level: 2, mode: 'reps', stresses: ['poignet', 'epaule'], met: 5, loaded: true,
    cues: ['Omoplates serrées sur le banc', 'Descends les haltères au niveau de la poitrine', 'Pousse en expirant'] }),
  E({ id: 'rowingHaltere', name: 'Rowing haltère un bras', category: 'strength', muscles: ['dos', 'biceps'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['dos'], met: 4.5, loaded: true,
    cues: ['Main et genou en appui (chaise ou banc)', 'Tire le coude vers la hanche', 'Dos plat, ne tourne pas le buste'] }),
  E({ id: 'developpeMilitaire', name: 'Développé épaules haltères', category: 'strength', muscles: ['epaules', 'triceps'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['epaule', 'poignet'], met: 4.5, loaded: true,
    cues: ['Assis ou debout, abdos serrés', 'Pousse les haltères au-dessus de la tête', 'Ne creuse pas le dos'] }),
  E({ id: 'elevationsLaterales', name: 'Élévations latérales', category: 'strength', muscles: ['epaules'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['epaule'], met: 3.5, loaded: true,
    cues: ['Bras presque tendus', 'Monte jusqu’à l’horizontale', 'Redescends lentement'] }),
  E({ id: 'curlHalteres', name: 'Curl biceps haltères', category: 'strength', muscles: ['biceps'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['poignet', 'coude'], met: 3.5, loaded: true,
    cues: ['Coudes collés au corps', 'Monte sans balancer le buste', 'Descente contrôlée'] }),
  E({ id: 'curlMarteau', name: 'Curl marteau', category: 'strength', muscles: ['biceps'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['coude'], met: 3.5, loaded: true,
    cues: ['Paumes face à face', 'Coudes fixes', 'Monte et descends lentement'] }),
  E({ id: 'extensionTriceps', name: 'Extension triceps au-dessus de la tête', category: 'strength', muscles: ['triceps'], equipment: ['dumbbells'], level: 1, mode: 'reps', stresses: ['coude', 'epaule'], met: 3.5, loaded: true,
    cues: ['Haltère tenu à deux mains derrière la tête', 'Tends les bras vers le plafond', 'Coudes pointés vers l’avant'] }),

  // ───────── Élastiques ─────────
  E({ id: 'tirageElastique', name: 'Rowing élastique', category: 'strength', muscles: ['dos', 'biceps'], equipment: ['bands'], level: 1, mode: 'reps', stresses: [], met: 3.5,
    cues: ['Élastique accroché devant toi', 'Tire les coudes vers l’arrière', 'Serre les omoplates'] }),
  E({ id: 'facePull', name: 'Face pull élastique', category: 'strength', muscles: ['epaules', 'dos'], equipment: ['bands'], level: 1, mode: 'reps', stresses: ['epaule'], met: 3,
    cues: ['Élastique à hauteur de visage', 'Tire vers le front, coudes hauts', 'Pause d’une seconde'] }),
  E({ id: 'pallof', name: 'Pallof press', category: 'core', muscles: ['abdos'], equipment: ['bands'], level: 1, mode: 'reps', stresses: [], met: 3,
    cues: ['Élastique sur le côté, à hauteur de poitrine', 'Pousse les mains devant toi', 'Résiste à la rotation'] }),
  E({ id: 'squatElastique', name: 'Squat avec élastique', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: ['bands'], level: 1, mode: 'reps', stresses: ['genou', 'hanche'], met: 5,
    cues: ['Élastique sous les pieds, tenu aux épaules', 'Descends en squat', 'Pousse fort vers le haut'] }),

  // ───────── Kettlebell ─────────
  E({ id: 'swingKettlebell', name: 'Kettlebell swing', category: 'strength', muscles: ['fessiers', 'ischios', 'cardio'], equipment: ['kettlebell'], level: 2, mode: 'reps', stresses: ['dos'], met: 8, loaded: true,
    cues: ['Charnière de hanche, pas un squat', 'Projette les hanches vers l’avant', 'La kettlebell monte à hauteur de poitrine'] }),
  E({ id: 'gobletKettlebell', name: 'Goblet squat kettlebell', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: ['kettlebell'], level: 1, mode: 'reps', stresses: ['genou', 'hanche'], met: 5.5, loaded: true,
    cues: ['Kettlebell tenue par les cornes', 'Descends entre tes talons', 'Poitrine fière'] }),

  // ───────── Barre de traction ─────────
  E({ id: 'tractions', name: 'Tractions', category: 'strength', muscles: ['dos', 'biceps'], equipment: ['pullup_bar'], level: 3, mode: 'reps', stresses: ['epaule', 'coude', 'poignet'], met: 6,
    cues: ['Prise un peu plus large que les épaules', 'Tire le menton au-dessus de la barre', 'Descente lente et complète'], easier: 'Tractions négatives : saute en haut et descends en 5 s' }),
  E({ id: 'suspension', name: 'Suspension à la barre', category: 'strength', muscles: ['dos', 'epaules'], equipment: ['pullup_bar'], level: 1, mode: 'time', stresses: ['epaule', 'poignet'], met: 3,
    cues: ['Bras tendus, épaules engagées', 'Respire calmement', 'Pieds au sol si besoin'] }),
  E({ id: 'releveGenouxSuspendu', name: 'Relevés de genoux suspendu', category: 'core', muscles: ['abdos'], equipment: ['pullup_bar'], level: 2, mode: 'reps', stresses: ['epaule', 'poignet'], met: 4,
    cues: ['Suspendu, sans balancer', 'Monte les genoux vers la poitrine', 'Redescends lentement'] }),

  // ───────── Barre / salle ─────────
  E({ id: 'squatBarre', name: 'Squat barre', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: ['barbell'], level: 2, mode: 'reps', stresses: ['genou', 'hanche', 'dos'], met: 6, loaded: true,
    cues: ['Barre sur les trapèzes', 'Descends sous la parallèle si possible', 'Genoux dans l’axe, dos gainé'] }),
  E({ id: 'souleveTerre', name: 'Soulevé de terre', category: 'strength', muscles: ['ischios', 'fessiers', 'dos'], equipment: ['barbell'], level: 3, mode: 'reps', stresses: ['dos', 'hanche'], met: 6, loaded: true,
    cues: ['Barre au-dessus du milieu du pied', 'Dos plat, poitrine sortie', 'Pousse le sol avec les jambes'] }),
  E({ id: 'developpeCouche', name: 'Développé couché barre', category: 'strength', muscles: ['pectoraux', 'triceps', 'epaules'], equipment: ['barbell', 'bench'], level: 2, mode: 'reps', stresses: ['epaule', 'poignet', 'coude'], met: 5, loaded: true,
    cues: ['Omoplates serrées, pieds ancrés', 'Barre au bas des pectoraux', 'Pousse en expirant'] }),
  E({ id: 'rowingBarre', name: 'Rowing barre', category: 'strength', muscles: ['dos', 'biceps'], equipment: ['barbell'], level: 2, mode: 'reps', stresses: ['dos'], met: 5, loaded: true,
    cues: ['Buste penché à 45°, dos plat', 'Tire la barre vers le nombril', 'Coudes près du corps'] }),
  E({ id: 'developpeMilitaireBarre', name: 'Développé militaire barre', category: 'strength', muscles: ['epaules', 'triceps'], equipment: ['barbell'], level: 2, mode: 'reps', stresses: ['epaule', 'poignet', 'dos'], met: 5, loaded: true,
    cues: ['Debout, fessiers et abdos serrés', 'Pousse la barre au-dessus de la tête', 'Passe la tête sous la barre en haut'] }),
  E({ id: 'hipThrust', name: 'Hip thrust', category: 'strength', muscles: ['fessiers', 'ischios'], equipment: ['bench'], level: 2, mode: 'reps', stresses: ['hanche'], met: 4.5, loaded: true,
    cues: ['Haut du dos sur le banc', 'Pousse les hanches jusqu’à l’horizontale', 'Menton rentré'] }),

  // ───────── Machines ─────────
  E({ id: 'presseCuisses', name: 'Presse à cuisses', category: 'strength', muscles: ['quadriceps', 'fessiers'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['genou'], met: 5, loaded: true,
    cues: ['Pieds largeur d’épaules sur la plateforme', 'Descends jusqu’à 90° aux genoux', 'Ne verrouille pas les genoux en haut'] }),
  E({ id: 'legCurl', name: 'Leg curl', category: 'strength', muscles: ['ischios'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['genou'], met: 4, loaded: true,
    cues: ['Genoux alignés avec l’axe de la machine', 'Ramène les talons vers les fesses', 'Retour lent'] }),
  E({ id: 'legExtension', name: 'Leg extension', category: 'strength', muscles: ['quadriceps'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['genou'], met: 4, loaded: true,
    cues: ['Dos bien calé', 'Tends les jambes', 'Contrôle la descente'] }),
  E({ id: 'tirageVertical', name: 'Tirage vertical', category: 'strength', muscles: ['dos', 'biceps'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['epaule'], met: 4.5, loaded: true,
    cues: ['Prise large, buste légèrement incliné', 'Tire la barre vers le haut de la poitrine', 'Remonte lentement'] }),
  E({ id: 'rowingAssis', name: 'Rowing assis à la poulie', category: 'strength', muscles: ['dos', 'biceps'], equipment: ['machines'], level: 1, mode: 'reps', stresses: [], met: 4.5, loaded: true,
    cues: ['Dos droit, genoux légèrement fléchis', 'Tire la poignée vers le nombril', 'Serre les omoplates'] }),
  E({ id: 'chestPress', name: 'Chest press machine', category: 'strength', muscles: ['pectoraux', 'triceps'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['epaule', 'poignet'], met: 4.5, loaded: true,
    cues: ['Poignées à hauteur de poitrine', 'Pousse sans verrouiller les coudes', 'Retour contrôlé'] }),
  E({ id: 'shoulderPressMachine', name: 'Développé épaules machine', category: 'strength', muscles: ['epaules', 'triceps'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['epaule'], met: 4.5, loaded: true,
    cues: ['Dos collé au dossier', 'Pousse vers le haut', 'Redescends à hauteur d’oreilles'] }),
  E({ id: 'tricepsPoulie', name: 'Extension triceps à la poulie', category: 'strength', muscles: ['triceps'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['coude'], met: 3.5, loaded: true,
    cues: ['Coudes collés au corps', 'Pousse la corde vers le bas', 'Écarte les mains en bas'] }),
  E({ id: 'mollets_machine', name: 'Mollets à la machine', category: 'strength', muscles: ['mollets'], equipment: ['machines'], level: 1, mode: 'reps', stresses: ['cheville'], met: 3.5, loaded: true,
    cues: ['Amplitude complète', 'Pause en haut', 'Descente lente'] }),
];

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(LIST.map((e) => [e.id, e]));
export const EXERCISE_LIST = LIST;

export const MUSCLE_LABEL: Record<string, string> = {
  pectoraux: 'Pectoraux',
  dos: 'Dos',
  epaules: 'Épaules',
  biceps: 'Biceps',
  triceps: 'Triceps',
  abdos: 'Abdos',
  fessiers: 'Fessiers',
  quadriceps: 'Cuisses',
  ischios: 'Ischios',
  mollets: 'Mollets',
  cardio: 'Cardio',
  mobilite: 'Mobilité',
};

export const EQUIPMENT_LABEL: Record<string, string> = {
  dumbbells: 'Haltères',
  bands: 'Élastiques',
  kettlebell: 'Kettlebell',
  pullup_bar: 'Barre de traction',
  bench: 'Banc',
  barbell: 'Barre + disques',
  machines: 'Machines de salle',
};

export const BODY_PART_LABEL: Record<string, string> = {
  poignet: 'Poignet',
  coude: 'Coude',
  epaule: 'Épaule',
  nuque: 'Nuque',
  dos: 'Dos',
  genou: 'Genou',
  hanche: 'Hanche',
  cheville: 'Cheville',
};

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  warmup: 'Échauffement',
  strength: 'Renforcement',
  cardio: 'Cardio',
  core: 'Gainage',
  mobility: 'Mobilité',
};

export function exerciseName(id: string) {
  return EXERCISES[id]?.name ?? id;
}

export function musclesLabel(e: Exercise) {
  return e.muscles.map((m) => MUSCLE_LABEL[m]).join(', ');
}

export function equipmentLabel(e: Exercise) {
  return e.equipment.length ? e.equipment.map((q) => EQUIPMENT_LABEL[q]).join(' + ') : 'Sans matériel';
}

/** L'exercice est-il faisable avec ce matériel ? */
export function isAvailable(e: Exercise, equipment: Equipment[]) {
  return e.equipment.every((q) => equipment.includes(q));
}
