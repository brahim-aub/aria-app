/**
 * Système de design « carnet d'entraînement » (voir DESIGN.md).
 * Papier clair, encre ardoise #192126, un surligneur citron #BBF246 réservé
 * à ce qui fait avancer : action principale, progression, séance faite.
 * Les teintes de signal sont foncées pour rester lisibles (≥ 4,5:1 sur blanc).
 */
export const colors = {
  bg: '#F4F5F2',
  card: '#FFFFFF',
  cardAlt: '#ECEEEA',
  border: '#DFE2DD',
  borderStrong: '#C9CEC8',
  text: '#192126',
  muted: '#5B6267',
  /** Vert citron : fonds, pastilles, barres. Jamais en texte sur fond clair. */
  accent: '#BBF246',
  accentDim: 'rgba(187, 242, 70, 0.32)',
  /** Vert foncé lisible sur fond clair (texte, icônes, liens). */
  accentInk: '#4A7300',
  dark: '#192126',
  darkAlt: '#2A343A',
  /** Texte secondaire sur fond encre. */
  onDarkMuted: '#AEB6BA',
  violet: '#6447D1',
  violetDim: 'rgba(100, 71, 209, 0.10)',
  cyan: '#1F6F94',
  cyanDim: 'rgba(31, 111, 148, 0.10)',
  pink: '#C62F2F',
  pinkDim: 'rgba(198, 47, 47, 0.10)',
  yellow: '#8F6200',
  yellowDim: 'rgba(214, 155, 30, 0.16)',
  rest: '#B5530F',
  restDim: 'rgba(181, 83, 15, 0.10)',
  danger: '#C62F2F',
  onAccent: '#192126',
  onDark: '#FFFFFF',
  focus: '#192126',
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
  violet: '#EEEAFB',
  red: '#FBE9E9',
  orange: '#FBEFE4',
  blue: '#E6F0F5',
  lime: '#EEF8D6',
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

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

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
  return (1.05 / (L + 0.05)) >= (L + 0.05) / 0.064 ? colors.onDark : colors.text;
}
