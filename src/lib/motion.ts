import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, PressableStateCallbackType, ViewStyle } from 'react-native';

import { colors } from '@/theme';

/** true si l'utilisateur a demandé à réduire les animations (Android, iOS et web). */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduced(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Sur le web, Pressable expose aussi `focused` et `hovered`. */
export type PressState = PressableStateCallbackType & { focused?: boolean; hovered?: boolean };

// Comme :focus-visible : l'anneau n'apparaît que si le dernier geste était une touche du clavier.
let keyboardMode = false;
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter' || e.key === ' ') keyboardMode = true;
  }, true);
  document.addEventListener('pointerdown', () => (keyboardMode = false), true);
}

/** Anneau de focus clavier (web) : encre, 2 px, décalé. */
export const focusRing = (s: PressState, radius?: number, color: string = colors.focus): ViewStyle | null =>
  s.focused && keyboardMode ? { outlineColor: color, outlineWidth: 2, outlineStyle: 'solid', outlineOffset: 2, ...(radius != null && { borderRadius: radius }) } : null;

/** Retour de pression discret : léger enfoncement. */
export const pressFeedback = (s: PressState, scale = 0.98): ViewStyle | null => (s.pressed ? { transform: [{ scale }], opacity: 0.92 } : null);
