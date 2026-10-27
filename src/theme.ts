/** Mova : charbon, surfaces olive, citron pour agir, lavande pour le coach. Voir DESIGN.md. */
export const colors = {
  bg: '#0C100D',
  card: '#171D18',
  cardAlt: '#222A22',
  border: '#29332B',
  borderStrong: '#414D41',
  text: '#F3F5EF',
  muted: '#A4AFA2',
  /** Vert citron : fonds, pastilles, barres. Jamais en texte sur fond clair. */
  accent: '#CBF45C',
  accentDim: 'rgba(203, 244, 92, 0.13)',
  /** Citron lisible sur les surfaces sombres (texte, icônes, liens). */
  accentInk: '#CBF45C',
  dark: '#1D2719',
  darkAlt: '#34412A',
  /** Texte secondaire sur fond encre. */
  onDarkMuted: '#B6C0AE',
  violet: '#C4AEF5',
  violetDim: 'rgba(196, 174, 245, 0.11)',
  cyan: '#9ECFC7',
  cyanDim: 'rgba(31, 111, 148, 0.10)',
  pink: '#F3B29C',
  pinkDim: 'rgba(198, 47, 47, 0.10)',
  yellow: '#E4CD8D',
  yellowDim: 'rgba(214, 155, 30, 0.16)',
  rest: '#F4B381',
  restDim: 'rgba(181, 83, 15, 0.10)',
  danger: '#FFAAA2',
  onAccent: '#142008',
  onDark: '#FFFFFF',
  focus: '#CBF45C',
};

/** Couleur d'icône par famille (repère discret, jamais un fond plein). */
export const palette = {
  sport: colors.accentInk,
  coach: colors.violet,
  nutrition: colors.pink,
  trophy: colors.yellow,
  cardio: colors.cyan,
  rest: colors.rest,
};

/** Fonds très légers pour signaler un état (zone ménagée, info…), pas pour décorer. */
export const tints = {
  violet: '#2D2639',
  red: '#352421',
  orange: '#30271E',
  blue: '#1F3030',
  lime: '#27331D',
};

/** Lato (chargée dans app/_layout.tsx). */
export const font = {
  regular: 'Lato_400Regular',
  bold: 'Lato_700Bold',
  black: 'Lato_900Black',
};

/** Échelle typographique : display, title, h2, h3, body, small, micro. */
export const type = {
  display: { fontFamily: font.black, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  title: { fontFamily: font.black, fontSize: 26, lineHeight: 31, letterSpacing: -0.5 },
  h2: { fontFamily: font.black, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  h3: { fontFamily: font.bold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: font.bold, fontSize: 12, lineHeight: 16 },
} as const;

export const radius = { sm: 12, md: 20, lg: 28, pill: 999 };

export const spacing = { xs: 4, sm: 8, ms: 12, md: 16, lg: 24, xl: 32, xxl: 48 };

/** Durées d'animation (ms). Toutes coupées si « réduire les animations » est actif. */
export const motion = { press: 120, state: 220, fill: 420 };

/** Largeur maximale du contenu (tablette, web). */
export const layout = { maxWidth: 640, touch: 44 };

/** Seule ombre de l'app : éléments qui flottent au-dessus du contenu (barre d'onglets, toasts). */
export const floating = {
  shadowColor: '#192126',
  shadowOpacity: 0.18,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 8 },
  elevation: 8,
};

/** Texte lisible (encre ou blanc) sur un fond de couleur donné (#RRGGBB). */
export function readableOn(bg: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(bg);
  if (!m) return colors.text;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contraste avec le blanc contre contraste avec l'encre (#192126, L ≈ 0.014).
  return (1.05 / (L + 0.05)) >= (L + 0.05) / 0.064 ? colors.onDark : colors.onAccent;
}
