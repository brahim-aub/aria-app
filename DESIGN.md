# Aria Sport : direction artistique et système de design

## Pour qui, pour quoi

- **Utilisateurs** : adultes de 18 à 50 ans, débutants ou en reprise, qui s'entraînent seuls, chez eux ou en salle.
- **Usage** : ils ouvrent l'app une fois par jour, souvent debout, téléphone dans une main, juste avant de bouger.
- **Leur question** : « Qu'est-ce que je fais aujourd'hui, combien de temps, et est-ce que je peux l'adapter ? »
- **L'interface** répond à ça d'abord. Le reste (stats, succès, nutrition) vient ensuite.

## Direction : « carnet d'entraînement »

C'est un carnet de sport bien tenu : papier clair, encre ardoise, un surligneur citron.

- **Le citron** a un seul sens : *ce qui te fait avancer*. On le trouve sur l'action principale, les barres de progression et ce qui est fait. Jamais en décoration, jamais en texte sur fond clair.
- **Un seul élément audacieux par écran.** Sur l'accueil, c'est la carte « Aujourd'hui » : un bloc ardoise, une durée en très grands chiffres et un bouton citron. Tout le reste est calme.
- **Les chiffres sont l'élément graphique principal** : Lato Black, chiffres tabulaires, grande taille, avec une petite étiquette en minuscules à côté.
- **Pas de dégradés décoratifs, pas d'arc-en-ciel par section, pas d'ombres sur les cartes.** On sépare les blocs par la surface (fond, carte, encre) et un filet fin.
- **Pas d'étiquettes en capitales espacées**, pas de « → » ajouté aux boutons. Tout est en casse de phrase, avec des verbes d'action (« Commencer la séance », « Enregistrer »).

## Tokens (`src/theme.ts`)

| Rôle | Token | Valeur |
| --- | --- | --- |
| Fond de page | `bg` | `#F4F5F2` |
| Surface (carte) | `card` | `#FFFFFF` |
| Surface creusée (champ, piste) | `cardAlt` | `#ECEEEA` |
| Filet | `border` | `#DFE2DD` |
| Encre (texte, bloc fort) | `text` / `dark` | `#192126` |
| Encre secondaire | `muted` | `#5B6267` (6,1:1 sur blanc) |
| Citron (action, progrès) | `accent` | `#BBF246` |
| Vert lisible sur clair | `accentInk` | `#4A7300` |
| Signaux | `cyan` (info), `rest` (attention), `danger`, `violet` (coach), `yellow` (trophées) | teintes foncées ≥ 4,5:1 sur blanc |

- **Typographie** : Lato uniquement. Échelle `type` : 34 / 26 / 20 / 17 / 15 / 13 / 12. Graisses : Black pour les titres et chiffres, Bold pour les libellés, Regular pour le texte courant. Interligne d'environ 1,45 pour le corps.
- **Espacements** : base 4 (4, 8, 12, 16, 24, 32, 48).
- **Rayons** : la hiérarchie suit la taille. 10 pour un petit élément, 16 pour une ligne ou une carte, 24 pour un panneau, pilule pour les commandes.
- **Mouvement** : 120 ms pour la pression, 220 ms pour un changement d'état, 420 ms pour le remplissage d'une jauge. Tout est désactivé si l'utilisateur a choisi « réduire les animations ».
- **Largeur de contenu** : 640 px au maximum, centrée (tablette, web).

## Composants

- `Button` : `primary` (encre), `accent` (citron, seulement sur fond encre ou pour l'action unique de l'écran), `secondary`, `ghost`, `danger`. Le texte reste lisible quelle que soit la couleur passée (il se cale sur la luminance du fond). Hauteur ≥ 48.
- `IconButton`, `Chip`, `OptionCard`, `Field`, `Stepper`, `RatingPicker` : rôle d'accessibilité, état (sélectionné, coché, désactivé), cible ≥ 44 px, anneau de focus visible au clavier (web).
- `Panel` (remplace `GradientCard`) : ton `ink`, `accent` ou `surface`.
- `ProgressBar` : remplissage animé, rôle `progressbar`.
- `EmptyState` : une icône dans une pastille, un titre, une phrase qui dit quoi faire, et un bouton.

## Accessibilité

- Contraste AA pour tout le texte. Le citron n'est jamais du texte sur fond clair.
- Rôles et états sur tout ce qui se touche. Les titres d'écran ont le rôle `header`.
- Focus clavier visible sur le web : anneau encre de 2 px, décalé de 2 px.
- Les confirmations passent par `confirmAction` / `notify`, qui fonctionnent aussi sur le web.
