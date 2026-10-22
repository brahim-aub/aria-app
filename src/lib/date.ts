/** Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date) {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  const diff = (res.getDay() + 6) % 7;
  res.setDate(res.getDate() - diff);
  return res;
}

export function weekKey(d: Date) {
  const s = startOfWeek(d);
  return `${s.getFullYear()}-${s.getMonth() + 1}-${s.getDate()}`;
}

/** Week starts (Monday) for the last `n` weeks, oldest first, current week last. */
export function lastWeeks(n: number) {
  const current = startOfWeek(new Date());
  return Array.from({ length: n }, (_, i) => {
    // setDate plutôt que des millisecondes, pour rester juste lors des changements d'heure.
    const d = new Date(current);
    d.setDate(d.getDate() - (n - 1 - i) * 7);
    return d;
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatShort(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'numeric' });
}

export function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

/** Clé locale YYYY-MM-DD. */
export function dateKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

/** 0 = lundi … 6 = dimanche */
export function weekdayIndex(key: string) {
  return (parseKey(key).getDay() + 6) % 7;
}

export function formatKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return parseKey(key).toLocaleDateString('fr-FR', opts);
}

export function relativeDay(key: string) {
  const today = dateKey();
  if (key === today) return "Aujourd'hui";
  if (key === addDays(today, 1)) return 'Demain';
  if (key === addDays(today, -1)) return 'Hier';
  const label = formatKey(key, { weekday: 'long', day: 'numeric', month: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}
