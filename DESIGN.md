# Mova — direction artistique

Nom de travail : **Mova**. Signature : **À ton rythme. Pour de vrai.**
Le nom est une proposition créative ; sa disponibilité commerciale n’a pas été vérifiée.

## Intention
Une application d’entraînement accessible, calme et crédible. Les références fournies guident la hiérarchie et l’ambiance, sans reproduire leurs interfaces ou leurs personnages.
L’accent porte sur le mouvement régulier et la vie réelle, plutôt que sur la performance extrême.

## Système visuel
- Fond charbon : #0C100D.
- Cartes : #171D18 ; surfaces secondaires : #222A22.
- Texte principal : #F3F5EF ; secondaire : #A4AFA2.
- Citron : #CBF45C, réservé aux actions et aux états actifs.
- Lavande : #C4AEF5, repère du coach.
- Typographie Lato déjà installée : Regular pour lire, Bold pour agir, Black pour les titres.
- Cartes de 20 à 28 px de rayon, espacement principal de 24 px.
- Photographies éditoriales sombres, texte placé sur un dégradé garantissant sa lecture.
- Logo : trois traits inclinés, dont le trait central plus court évoque le mouvement. Le point citron accompagne le mot « mova. ».

## Règles UX
1. Une action principale immédiatement identifiable.
2. Un clic sur une séance ouvre son aperçu ; le démarrage demande un bouton dédié.
3. Les détails secondaires se déplient : rotations de séances, ingrédients, prix et calculs nutritionnels.
4. Garder les cinq libellés de navigation visibles.
5. Les outils complémentaires restent accessibles depuis Profil.
6. Pas de fausses statistiques, de fausse activité du coach ou de promesses de résultats.
7. Zones tactiles de 44 px minimum ; focus clavier visible ; respecter les préférences de mouvement existantes.
8. Les images illustrent l’univers de la marque, pas une démonstration d’exercice ni le résultat exact d’un menu.

## Écrans
- Connexion : marque, photo et proposition claire, formulaire séparé.
- Accueil : semaine, séance, coach, régularité.
- Programme : aperçu photographique de la prochaine séance ; calendrier et options distincts ; rotations repliables.
- Séance : image d’introduction, métriques et exercices ; démarrage explicite.
- Nutrition : visuel éditorial, repas en premier ; détails à la demande.
- Coach et Profil : mêmes couleurs, surfaces, contrôles et hiérarchie.

## Assets
- assets/mova/training.png — photographie générée pour la marque.
- assets/mova/nutrition.png — photographie générée pour la marque.
- assets/mova/mark.svg — logo vectoriel.
- assets/mova/icon.png — icône native et web.
- src/components/brand.tsx — logo et carte photographique réutilisables.

Les identifiants techniques, clés de stockage et connexions restent ceux du projet existant pour conserver les données et l’authentification.

## Charte conservée — version 1.1 · 27 octobre 2026
Source de vérité : src/theme.ts pour les valeurs ; ce document pour leurs usages.
La planche visuelle exportable est conservée dans outputs/Mova-charte-visuelle.html au niveau du dossier de travail.

### Palette fonctionnelle
| Usage | Token | Couleur |
|---|---|---|
| Fond | bg | #0C100D |
| Carte | card | #171D18 |
| Surface secondaire | cardAlt | #222A22 |
| Texte principal | text | #F3F5EF |
| Texte secondaire | muted | #A4AFA2 |
| Action, sélection, progression | accent | #CBF45C |
| Texte sur citron | onAccent | #142008 |
| Coach | violet | #C4AEF5 |
| Information | cyan | #9ECFC7 |
| Nutrition | pink | #F3B29C |
| Récupération, attention | rest | #F4B381 |
| Erreur | danger | #FFAAA2 |

### Dosage et composants
- Majorité de surfaces charbon/olive ; citron ponctuel pour guider l’action, pas sur toutes les cartes.
- Une seule famille d’accent secondaire par bloc. La couleur est toujours accompagnée d’un texte ou d’une icône.
- Bouton principal citron avec texte encre ; bouton secondaire sur surface sombre.
- Sélection et focus : citron visible. Les segments mesurent au moins 44 px de haut.
- Cartes de séance : titre sur deux lignes maximum, durée en pastille, nombre d’exercices, aperçu avant démarrage.
- Progrès : objectif de séances de la semaine, puis historique ; périodes 4, 8 ou 12 semaines. Valeurs issues du journal réel.
- Typographie : Lato Black 26–34 pour les titres, Bold 17–20 pour les sous-titres, Regular 15/22 pour le corps, 13/18 pour les métadonnées.
- Espacements : 4, 8, 12, 16, 24, 32, 48 px. Rayons : 12 pour contrôles, 20 pour cartes, 28 pour images éditoriales.
- Photographies : adultes variés, lumière naturelle ou salle sombre, mouvement crédible, espace libre pour le texte. Aucun texte incrusté dans l’image.
- Voix : tutoiement, phrases courtes, encouragement sans culpabiliser. Verbes précis : Découvrir, Commencer, Adapter.

### Sélection des nouvelles références
Conserver les pastilles de durée, les indicateurs de progression lisibles et les choix de période. Préserver la fiche avant le lancement, déjà présente dans Mova.
Ne pas ajouter de pas, fréquence cardiaque, eau ou calories mesurées sans données correspondantes ; ne pas ajouter de notes communautaires fictives. Les graphes servent à comprendre une mesure, pas à remplir l’écran.
Ne pas multiplier orange, turquoise et violet en grands fonds concurrents. Ne pas cacher les libellés de navigation derrière des icônes seules.
