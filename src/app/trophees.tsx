import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Panel, ProgressBar } from '@/components/kit';
import { Chip, Muted, Screen } from '@/components/ui';
import { Achievement, ACHIEVEMENTS, levelFromPoints, levelTitle, progressOf, TIER_COLOR, TIER_LABEL, TIER_POINTS, totalPoints } from '@/data/achievements';
import { formatDate } from '@/lib/date';
import { computeStats } from '@/lib/stats';
import { useApp } from '@/store/AppStore';
import { colors, font, radius, spacing, type } from '@/theme';

const CATEGORIES = ['Tous', ...new Set(ACHIEVEMENTS.map((a) => a.category))];

export default function Trophees() {
  const { data } = useApp();
  const [cat, setCat] = useState('Tous');
  const stats = computeStats(data);
  const points = totalPoints(data.achievements, stats.sessions);
  const lvl = levelFromPoints(points);
  const unlockedCount = ACHIEVEMENTS.filter((a) => data.achievements[a.id]).length;
  const list = ACHIEVEMENTS.filter((a) => cat === 'Tous' || a.category === cat).sort(
    (a, b) => Number(!!data.achievements[b.id]) - Number(!!data.achievements[a.id]) || progressOf(b, stats).ratio - progressOf(a, stats).ratio,
  );

  return (
    <Screen top={false}>
      <Panel>
      <View style={styles.summary}>
        <View style={{ flex: 1 }}>
          <Text style={styles.big}>
            {unlockedCount}
            <Text style={styles.of}>/{ACHIEVEMENTS.length}</Text>
          </Text>
          <Muted>succès débloqués</Muted>
        </View>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.big}>Niv. {lvl.level}</Text>
          <Muted>
            {levelTitle(lvl.level)}, {points} pts
          </Muted>
        </View>
      </View>
      <ProgressBar ratio={lvl.into / lvl.need} label="Progression vers le niveau suivant" />
      <Muted style={{ fontSize: 13 }}>Chaque séance rapporte 5 points, chaque succès de 10 à 80 points selon sa rareté.</Muted>
      </Panel>

      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={cat === c} onPress={() => setCat(c)} />
        ))}
      </View>

      <View style={styles.grid}>
        {list.map((a) => (
          <Badge key={a.id} a={a} unlockedAt={data.achievements[a.id]} progress={progressOf(a, stats)} />
        ))}
      </View>
    </Screen>
  );
}

function Badge({ a, unlockedAt, progress }: { a: Achievement; unlockedAt?: string; progress: ReturnType<typeof progressOf> }) {
  const color = TIER_COLOR[a.tier];
  const hidden = a.secret && !unlockedAt;
  return (
    <View style={[styles.badge, unlockedAt ? { borderColor: color } : styles.badgeLocked]} accessible accessibilityLabel={hidden ? 'Succès secret, pas encore débloqué' : `${a.title}, ${TIER_LABEL[a.tier]}, ${unlockedAt ? 'débloqué' : 'pas encore débloqué'}`}>
      <View style={[styles.icon, { backgroundColor: unlockedAt ? color + '25' : colors.cardAlt, borderColor: unlockedAt ? color : colors.border }]}>
        <Ionicons name={hidden ? 'help' : unlockedAt ? a.icon : 'lock-closed'} size={26} color={unlockedAt ? color : colors.muted} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {hidden ? 'Succès secret' : a.title}
      </Text>
      <Text style={styles.desc} numberOfLines={3}>
        {hidden ? 'Continue de t’entraîner pour le découvrir…' : a.description}
      </Text>
      <Text style={[styles.tier, { color }]}>
        {TIER_LABEL[a.tier]}, {TIER_POINTS[a.tier]} pts
      </Text>
      {unlockedAt ? (
        <Text style={styles.date}>{formatDate(unlockedAt)}</Text>
      ) : !hidden ? (
        <View style={{ alignSelf: 'stretch', gap: 2 }}>
          <ProgressBar ratio={progress.ratio} color={colors.dark} height={5} />
          <Text style={styles.date}>
            {Math.floor(progress.value).toLocaleString('fr-FR')} / {a.target.toLocaleString('fr-FR')}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'flex-end' },
  big: { color: colors.text, fontSize: 30, fontFamily: font.black },
  of: { fontFamily: font.regular, color: colors.muted, fontSize: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badge: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    minWidth: 150,
    padding: spacing.md,
    alignItems: 'center',
    gap: 6,
  },
  badgeLocked: { backgroundColor: colors.bg },
  icon: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontFamily: font.black, textAlign: 'center' },
  desc: { color: colors.muted, ...type.small, fontSize: 12, textAlign: 'center' },
  tier: { fontSize: 12, fontFamily: font.black },
  date: { color: colors.muted, fontSize: 12, fontFamily: font.regular, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
