# Aria Sport

App de sport boostée à l'IA (Expo SDK 58, Android en priorité). Pensée pour tout le monde, et surtout pour les débutants : un programme généré à l'inscription, puis un coach IA (Gemini) qui l'adapte en un message.

## Fonctionnalités (MVP)

- **Onboarding** en 9 étapes : objectif, expérience et niveau, âge, taille, poids, lieu et matériel, rythme (séances/semaine, durée, jours), douleurs éventuelles, quotidien et nutrition.
- **Programme généré** : split adapté à la fréquence (full body, haut/bas, push/pull/legs…), exercices choisis selon le matériel et le niveau, séries, reps et repos selon l'objectif, durée ajustée automatiquement.
- **Coach IA (Gemini)** : il lit le profil, le planning des 2 semaines, les douleurs et la nutrition, puis **agit sur l'app** :
  - « j'ai que 15 min » → séance du jour raccourcie ;
  - « pas de matériel aujourd'hui » → séance sans matériel sur les mêmes muscles ;
  - « décale à demain » → décalage en cascade ;
  - « mal au poignet pendant 2 semaines » → zone ménagée : tous les exercices qui sollicitent le poignet sont remplacés automatiquement sur la période ;
  - changement durable (salle, 4 séances/semaine…) → profil mis à jour et programme reconstruit ;
  - goûts alimentaires → enregistrés, puis menus sur 7 jours générés.
  Chaque modification est listée sous le message, avec un bouton **Annuler**.
- **Bibliothèque** : environ 80 exercices (poids du corps, haltères, élastiques, kettlebell, barre de traction, barre, machines), avec consignes, version plus facile et articulations sollicitées.
- **Séances prêtes** (débutant → expert, sans matériel / petit matériel / salle) et **créateur de séance** (séries classiques ou circuit).
- **Lecteur de séance** : échauffement, minuteur, repos, saisie des reps et de la charge, calories estimées, ressenti en fin de séance.
- **Succès façon RPG** : 40+ succès bronze/argent/or/légendaire (séances, heures, tonnage, régularité, exploration, secrets), points et niveaux.
- **Nutrition** : besoins calculés (Mifflin-St Jeor × activité du quotidien + dépense des séances prévues, ajustés selon l'objectif), macros, menus 7 jours avec recettes et liste de courses.
- **Prix réels en magasin** : tu choisis jusqu'à 3 magasins (Leclerc, Lidl, Carrefour…) dans « Mes goûts ». Gemini cherche en ligne (recherche Google) le prix de chaque ingrédient de tes menus dans chacun : produit, format, prix du paquet, prix au kilo et **page source**. Aucun prix n'est estimé : sans source, l'ingrédient reste « prix non trouvé ». L'app compare les magasins (ticket de caisse de la semaine en paquets entiers), affiche le coût de chaque repas et la liste de courses chiffrée, et vérifie ton budget. Le coach peut aussi lancer la recherche (« combien ça coûte chez Lidl ? »). Code : `src/lib/prices.ts`.
  ⚠️ La recherche Google de Gemini demande d'**activer la facturation** sur le projet Google AI Studio (sinon l'app affiche une erreur au lieu d'inventer des prix).
- Journal, progrès, suivi du poids, chrono et rappels (reprise de la v1).

Tout est stocké en local sur le téléphone (AsyncStorage). Seuls les messages au coach et le contexte du programme sont envoyés à Gemini.

## Clé API Gemini

La clé est lue dans `.env` (`EXPO_PUBLIC_GEMINI_API_KEY`) et peut être remplacée dans l'app (Profil → Réglages → Coach IA).

⚠️ Une clé `EXPO_PUBLIC_` est intégrée en clair dans l'APK. C'est acceptable pour un usage perso ou des testeurs de confiance. Avant une diffusion publique, il faudra passer par un petit serveur relais (Cloudflare Worker, Firebase Function…) qui garde la clé côté serveur.

Modèles essayés dans l'ordre (bascule automatique si l'un est saturé) : `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash-lite`, `gemini-flash-latest` (voir `src/lib/gemini.ts`).

## Lancer sur ton téléphone

```bash
npx expo start
```
Scanne le QR code avec Expo Go (même Wi-Fi).

## Générer l'APK

```bash
npx eas-cli@latest build -p android --profile preview
```
Il faut un compte Expo gratuit. Le `.env` est envoyé au build grâce à `.easignore` (il reste exclu de git via `.gitignore`).

## Structure

- `src/app/` : écrans (Expo Router). `(tabs)/` = Accueil, Programme, Coach, Nutrition, Profil.
- `src/data/` : exercices, générateur de programme, séances prêtes, succès.
- `src/lib/coach.ts` : prompt, schéma JSON et application des actions du coach ; `gemini.ts` : client API.
- `src/lib/schedule.ts` : planning (rotation + modifications + adaptation aux douleurs).
- `src/lib/workout.ts` : durées, calories, étapes du lecteur, substitutions d'exercices.
- `src/store/` : état de l'app et types.

## Vérifier le code

```bash
npm run typecheck
npm run lint
```
