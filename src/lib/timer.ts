import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Vibration } from 'react-native';

/** Renvoie Date.now() rafraîchi toutes les `ms` tant que `active` est vrai. */
export function useNow(active: boolean, ms = 200) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, ms);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [active, ms]);
  return now;
}

/** Petite vibration à 3, 2, 1 secondes de la fin. */
export function useCountdownCues(remainingSec: number | null) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (remainingSec == null) {
      last.current = null;
      return;
    }
    const s = Math.ceil(remainingSec);
    if (s !== last.current && s >= 1 && s <= 3) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    last.current = s;
  }, [remainingSec]);
}

export function endCue() {
  Vibration.vibrate(350);
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
