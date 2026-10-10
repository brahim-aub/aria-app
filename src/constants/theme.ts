import type { Category } from '@/lib/types';

/**
 * Identité visuelle : fond clair, noir profond pour les éléments forts et un vert vif « volt »
 * pour l'énergie (actions principales, progression). Les catégories d'exercices ont chacune
 * une teinte douce, réservée aux pastilles d'icônes.
 */
export const Colors = {
  primary: '#0E0F12',
  ink: '#0E0F12',
  inkSoft: '#1C1E23',
  accent: '#C5F236',
  /** Version foncée du vert, lisible sur fond blanc (icônes, petits textes). */
  accentDeep: '#4F7F00',
  accentSoft: '#EEF9CC',
  background: '#F4F4F0',
  card: '#FFFFFF',
  surface: '#ECECE6',
  text: '#0E0F12',
  textSecondary: '#6B6D72',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#9EA1A8',
  border: '#E4E4DE',
  borderOnDark: '#2C2F36',
  coral: '#FF6A47',
  white: '#FFFFFF',
} as const;

export const CategoryColors: Record<Category, { tint: string; icon: string }> = {
  haut: { tint: '#ECE9FF', icon: '#5B45E0' },
  bas: { tint: '#FFEDE2', icon: '#D9561C' },
  gainage: { tint: '#E2EFFF', icon: '#2468D8' },
  cardio: { tint: '#FFE5E9', icon: '#D93A4D' },
  mobilite: { tint: '#DEF5EA', icon: '#12895A' },
};

export const CategoryIcons: Record<Category, 'barbell' | 'walk' | 'body' | 'flame' | 'leaf'> = {
  haut: 'barbell',
  bas: 'walk',
  gainage: 'body',
  cardio: 'flame',
  mobilite: 'leaf',
};

/** Police Plus Jakarta Sans, chargée au démarrage dans le layout racine. */
export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

/** Ombre douce pour détacher les cartes du fond. */
export const Shadow = {
  boxShadow: '0px 1px 2px rgba(14, 15, 18, 0.04), 0px 8px 24px rgba(14, 15, 18, 0.06)',
} as const;
