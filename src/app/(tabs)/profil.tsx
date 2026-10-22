import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Panel, ProgressBar, SectionHeader } from '@/components/kit';
import { H1, IconName, Muted, Screen } from '@/components/ui';
import { ACHIEVEMENTS, levelFromPoints, levelTitle, TIER_COLOR, totalPoints } from '@/data/achievements';
import { GOAL_LABEL, LEVEL_LABEL } from '@/data/generator';
import { computeStats } from '@/lib/stats';
import { focusRing, PressState } from '@/lib/motion';
import { useApp } from '@/store/AppStore';
import { colors, font, radius, spacing, type } from '@/theme';

export default function Profil() {
  const { data } = useApp();
  const p = data.profile;
  const stats = computeStats(data);
  const points = totalPoints(data.achievements, stats.sessions);
  const lvl = levelFromPoints(points);
  const recent = ACHIEVEMENTS.filter((a) => data.achievements[a.id])
    .sort((a, b) => data.achievements[b.id].localeCompare(data.achievements[a.id]))
    .slice(0, 4);
  const hours = Math.floor(stats.minutes / 60);

  return (
    <Screen>
      <H1 style={{ marginTop: spacing.sm }}>Profil</H1>

      <Panel onPress={() => router.push('/trophees')} label={`${p.name || 'Profil'}, niveau ${lvl.level}, ${points} points. Voir les trophées`}>
        <View style={styles.rowCenter}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(p.name || '?').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {p.name || 'Sportif'}
            </Text>
            <Text style={styles.sub}>
              {GOAL_LABEL[p.goal]}, {LEVEL_LABEL[p.level].toLowerCase()}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </View>
        <View style={styles.levelRow}>
          <Text style={styles.levelTitle}>
            Niveau {lvl.level} <Text style={styles.levelName}>{levelTitle(lvl.level)}</Text>
          </Text>
          <Text style={styles.points}>{points} pts</Text>
        </View>
        <ProgressBar ratio={lvl.into / lvl.need} height={8} label="Progression vers le niveau suivant" />
        <Text style={styles.sub}>Encore {lvl.need - lvl.into} points pour le niveau {lvl.level + 1}.</Text>
      </Panel>

      <View style={styles.grid}>
        <StatTile icon="checkmark-done" value={`${stats.sessions}`} label="séances" />
        <StatTile icon="time" value={hours ? `${hours}h${String(stats.minutes % 60).padStart(2, '0')}` : `${stats.minutes} min`} label="d’entraînement" />
        <StatTile icon="barbell" value={stats.volumeKg >= 1000 ? `${(stats.volumeKg / 1000).toFixed(1)} t` : `${stats.volumeKg} kg`} label="soulevés" />
        <StatTile icon="flame" value={`${stats.kcal}`} label="kcal brûlées" />
      </View>

      <SectionHeader title="Derniers succès" action="Tout voir" onAction={() => router.push('/trophees')} />
      {recent.length ? (
        <View style={styles.badges}>
          {recent.map((a) => (
            <View key={a.id} style={styles.badge} accessible accessibilityLabel={`Succès : ${a.title}`}>
              <View style={[styles.badgeIcon, { borderColor: TIER_COLOR[a.tier], backgroundColor: TIER_COLOR[a.tier] + '22' }]}>
                <Ionicons name={a.icon} size={24} color={TIER_COLOR[a.tier]} />
              </View>
              <Text style={styles.badgeText} numberOfLines={2}>
                {a.title}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Muted>Termine ta première séance pour débloquer ton premier succès !</Muted>
      )}

      <SectionHeader title="Mon espace" />
      <View style={styles.menu}>
        <MenuItem icon="trophy-outline" label="Salle des trophées" onPress={() => router.push('/trophees')} />
        <MenuItem icon="trending-up-outline" label="Progrès & poids" onPress={() => router.push('/progres')} />
        <MenuItem icon="book-outline" label="Journal des séances" onPress={() => router.push('/journal')} />
        <MenuItem icon="albums-outline" label="Séances prêtes & mes séances" onPress={() => router.push('/seances')} />
        <MenuItem icon="library-outline" label="Bibliothèque d’exercices" onPress={() => router.push('/exercices')} />
        <MenuItem icon="timer-outline" label="Chrono & minuteurs" onPress={() => router.push('/chrono')} />
        <MenuItem icon="settings-outline" label="Réglages du profil et du programme" onPress={() => router.push('/reglages')} last />
      </View>
    </Screen>
  );
}

function StatTile({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${value} ${label}`}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function MenuItem({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(s: PressState) => [styles.menuItem, !last && styles.menuBorder, (s.pressed || s.hovered) && { backgroundColor: colors.bg }, focusRing(s, radius.sm)]}
    >
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={colors.text} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.onAccent, fontFamily: font.black, fontSize: 24 },
  name: { color: colors.text, ...type.h2 },
  sub: { color: colors.muted, ...type.small },
  levelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.sm },
  levelTitle: { color: colors.text, fontFamily: font.black, fontSize: 15 },
  levelName: { color: colors.muted, fontFamily: font.bold },
  points: { color: colors.text, fontFamily: font.black, fontSize: 15, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '48.5%', flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 2 },
  tileValue: { color: colors.text, fontSize: 24, fontFamily: font.black, fontVariant: ['tabular-nums'], marginTop: 6 },
  tileLabel: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
  badges: { flexDirection: 'row', gap: spacing.sm },
  badge: { flex: 1, alignItems: 'center', gap: 6 },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.text, fontSize: 11, fontFamily: font.bold, textAlign: 'center' },
  menu: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.ms },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: colors.text, fontFamily: font.bold, flex: 1 },
});
