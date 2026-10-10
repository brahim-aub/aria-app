import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Body,
  Card,
  IconTile,
  type IconName,
  ProgressBar,
  Screen,
  SectionHeader,
  Title,
} from '@/components/ui';
import { Colors, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { ACHIEVEMENTS, achievementPoints, isUnlocked, totalMinutes, totalReps } from '@/lib/stats';
import { weekStreak } from '@/lib/week';
import { useAppStore } from '@/store/app-store';

const FEELING_LABELS = { facile: 'Trop facile', bien: 'Juste bien', dur: 'Trop dur' } as const;

export default function Progress() {
  const history = useAppStore((state) => state.history);
  const weeklyGoal = useAppStore((state) => state.profile?.trainingDays.length ?? 3);
  // Les succès seront réservés aux comptes ; pendant les tests, ils sont débloqués.
  const canSeeAchievements = useAppStore((state) => !state.isGuest || state.testMode);
  const ctx = { weeklyGoal };

  const unlockedCount = ACHIEVEMENTS.filter((a) => isUnlocked(a, history, ctx)).length;
  const stats: { label: string; value: number; icon: IconName; tint: string; color: string }[] = [
    {
      label: 'Séances terminées',
      value: history.filter((item) => !item.partial).length,
      icon: 'checkmark-circle',
      tint: '#DEF5EA',
      color: '#12895A',
    },
    {
      label: 'Semaines réussies d\'affilée',
      value: weekStreak(history, weeklyGoal),
      icon: 'flame',
      tint: '#FFEDE2',
      color: '#D9561C',
    },
    { label: 'Minutes d\'effort', value: totalMinutes(history), icon: 'time', tint: '#E2EFFF', color: '#2468D8' },
    { label: 'Répétitions', value: totalReps(history), icon: 'barbell', tint: '#ECE9FF', color: '#5B45E0' },
  ];

  return (
    <Screen>
      <Title style={styles.title}>Progrès</Title>

      <Card variant="dark" style={styles.hero}>
        <Text style={styles.heroEyebrow}>Points de succès</Text>
        <Text style={styles.heroValue}>{achievementPoints(history, ctx).toLocaleString('fr-FR')}</Text>
        <Text style={styles.heroMeta}>
          {unlockedCount} succès sur {ACHIEVEMENTS.length} débloqués
        </Text>
        <ProgressBar value={unlockedCount / ACHIEVEMENTS.length} color={Colors.accent} track={Colors.inkSoft} />
      </Card>

      <View style={styles.grid}>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <IconTile icon={stat.icon} tint={stat.tint} color={stat.color} size={38} />
            <Text style={styles.statValue}>{stat.value.toLocaleString('fr-FR')}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <SectionHeader title="Succès" />
      {canSeeAchievements ? (
        <View style={styles.grid}>
          {ACHIEVEMENTS.map((achievement) => {
            const { value, target } = achievement.progress(history, ctx);
            const unlocked = isUnlocked(achievement, history, ctx);
            return (
              <View key={achievement.id} style={styles.achievement}>
                <View style={styles.achievementTop}>
                  <View style={[styles.medal, unlocked && styles.medalUnlocked]}>
                    <Ionicons
                      name={unlocked ? 'medal' : 'lock-closed'}
                      size={20}
                      color={unlocked ? Colors.ink : Colors.textSecondary}
                    />
                  </View>
                  <Badge label={`${achievement.points} pts`} tone={unlocked ? 'accent' : 'neutral'} />
                </View>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.achievementText}>{achievement.description}</Text>
                <ProgressBar value={value / target} height={6} color={unlocked ? Colors.accentDeep : Colors.ink} />
                <Text style={styles.achievementText}>
                  {Math.min(value, target).toLocaleString('fr-FR')} / {target.toLocaleString('fr-FR')}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Card>
          <Body>Crée un compte pour débloquer les succès et garder ta progression.</Body>
        </Card>
      )}

      <SectionHeader title="Historique" />
      {history.length === 0 ? (
        <Card variant="soft">
          <Body muted>Ta première séance apparaîtra ici.</Body>
        </Card>
      ) : (
        <Card style={styles.list}>
          {history.slice(0, 20).map((item) => {
            const date = new Date(item.completedAt);
            return (
              <View key={item.completedAt} style={styles.historyRow}>
                <View style={styles.dateTile}>
                  <Text style={styles.dateDay}>{date.getDate()}</Text>
                  <Text style={styles.dateMonth}>
                    {date.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                  </Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.historyTitle}>{item.title}</Text>
                  <Text style={styles.achievementText}>
                    {Math.max(1, Math.round(item.durationSeconds / 60))} min
                    {item.partial ? ' · arrêtée avant la fin' : ''}
                    {item.feeling ? ` · ${FEELING_LABELS[item.feeling]}` : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginTop: Spacing.sm },
  hero: { padding: Spacing.lg, gap: Spacing.sm },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textOnDarkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroValue: { fontSize: 48, lineHeight: 54, fontFamily: Fonts.extrabold, color: Colors.accent, letterSpacing: -1 },
  heroMeta: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.textOnDarkMuted, marginBottom: Spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm + 2 },
  stat: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
    ...Shadow,
  },
  statValue: { fontSize: 26, lineHeight: 32, fontFamily: Fonts.extrabold, color: Colors.text, marginTop: Spacing.xs },
  statLabel: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.medium, color: Colors.textSecondary },
  achievement: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: 6,
    ...Shadow,
  },
  achievementTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  medal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalUnlocked: { backgroundColor: Colors.accent },
  achievementTitle: { fontSize: 15, lineHeight: 20, fontFamily: Fonts.bold, color: Colors.text },
  achievementText: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.regular, color: Colors.textSecondary },
  list: { paddingVertical: Spacing.sm, gap: 0 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  dateTile: {
    width: 46,
    height: 50,
    borderRadius: Radius.sm + 2,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 18, lineHeight: 22, fontFamily: Fonts.extrabold, color: Colors.text },
  dateMonth: { fontSize: 11, fontFamily: Fonts.semibold, color: Colors.textSecondary, textTransform: 'uppercase' },
  historyTitle: { fontSize: 16, fontFamily: Fonts.semibold, color: Colors.text },
});
