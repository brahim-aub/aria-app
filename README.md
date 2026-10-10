# Aria

Application Android de sport à la maison pour débutants. Chaque séance s'adapte à la personne : ses douleurs, son temps du jour et son niveau. Un coach IA (à venir) aidera à construire et modifier les séances ; l'appli reste utilisable sans lui et sans connexion.

## Démarrer

```bash
npm install
npx expo start
```

Scanne le QR code avec l'appli Expo Go sur ton téléphone Android, ou lance un émulateur avec `a`.

Pour tester dans le navigateur, lance `npm run web` (ou appuie sur `w` dans `npx expo start`). Sur le web, les données sont gardées dans le navigateur (localStorage) au lieu de SQLite.

## Vérifications

```bash
npm run typecheck
npm run lint
```

## Organisation du code

| Dossier | Contenu |
| --- | --- |
| `src/app/` | Écrans (Expo Router) : onboarding, onglets, lecteur de séance, fiche exercice |
| `src/data/exercises.ts` | Bibliothèque fixe d'exercices et leurs variantes plus douces |
| `src/lib/program.ts` | Générateur de séance adapté au profil, au temps et aux douleurs |
| `src/lib/stats.ts` | Séries de jours, répétitions et succès |
| `src/lib/nutrition.ts` | Besoins caloriques et macros (Mifflin-St Jeor) |
| `src/store/app-store.ts` | État de l'appli, stocké sur le téléphone (mode invité) |

## Phase de test

- Le bouton « Passer (test) » de l'onboarding crée un profil par défaut. Il sera retiré avant la publication.
- `testMode` dans `src/store/app-store.ts` débloque les fonctionnalités réservées aux comptes (succès). À passer à `false` quand les comptes seront actifs.
