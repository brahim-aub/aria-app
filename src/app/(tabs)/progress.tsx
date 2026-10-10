import { StyleSheet, Text, View } from 'react-native';

import { Body, Card, ProgressBar, Row, Screen, Title } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ACHIEVEMENTS, achievementPoints, isUnlocked, totalMinutes, totalReps } from '@/lib/stats';
import { weekStreak } from '@/lib/week';
import { useAppStore } from '@/store/app-store';

const FEELING_LABELS = { facile: 'Trop facile', bien: 'Juste bien', dur: 'Trop dur' } as const;

export default function Progress() {
  const history = useAppStore((state) => state.history);
  const weeklyGoal = useAppStore((state) => state.profile?.trainingDays.length ?? 3);
  const ctx = { weeklyGoal };
  // Les succès seront réservés aux comptes ; pendant les tests, ils sont débloqués.
  const canSeeAchievements = useAppStore((state) => !state.isGuest || state.testMode);

  const stats = [
    { label: 'Séances terminées', value: history.filter((item) => !item.partial).length },
    { label: 'Semaines réussies d\'affilée', value: weekStreak(history, weeklyGoal) },
    { label: 'Minutes d\'effort', value: totalMinutes(history) },
    { label: 'Répétitions', value: totalReps(history) },
    { label: 'Points de succès', value: achievementPoints(history, ctx) },
  ];

  return (
    <Screen>
      <Title>Progrès</Title>
      <Row>
        {stats.map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value.toLocaleString('fr-FR')}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </Row>

      <Text style={styles.section}>Succès</Text>
      {canSeeAchievements ? (
        ACHIEVEMENTS.map((achievement) => {
          const { value, target } = achievement.progress(history, ctx);
          const unlocked = isUnlocked(achievement, history, ctx);
          return (
            <Card key={achievement.id} style={unlocked ? styles.unlocked : undefined}>
              <View style={styles.achievementHeader}>
                <Text style={styles.achievementTitle}>{achievement.title}</Text>
                <Text style={styles.points}>{achievement.points} pts</Text>
              </View>
              <Body muted>{achievement.description}</Body>
              <ProgressBar value={value / target} color={unlocked ? Colors.accent : Colors.textSecondary} />
              <Text style={styles.progressText}>
                {Math.min(value, target).toLocaleString('fr-FR')} / {target.toLocaleString('fr-FR')}
              </Text>
            </Card>
          );
        })
      ) : (
        <Card>
          <Body>Crée un compte pour débloquer les succès et garder ta progression.</Body>
        </Card>
      )}

      <Text style={styles.section}>Historique</Text>
      {history.length === 0 && <Body muted>Ta première séance apparaîtra ici.</Body>}
      {history.slice(0, 20).map((item) => (
        <Card key={item.completedAt}>
          <Text style={styles.achievementTitle}>{item.title}</Text>
          <Body muted>
            {new Date(item.completedAt).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            · {Math.max(1, Math.round(item.durationSeconds / 60))} min
            {item.partial ? ' · arrêtée avant la fin' : ''}
            {item.feeling ? ` · ${FEELING_LABELS[item.feeling]}` : ''}
          </Body>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stat: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: 26, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 14, color: Colors.textSecondary, fontWeight: '600' },
  section: { fontSize: 20, fontWeight: '600', color: Colors.text, marginTop: Spacing.sm },
  unlocked: { borderColor: Colors.accent },
  achievementHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achievementTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
  points: { fontSize: 14, fontWeight: '500', color: Colors.textSecondary },
  progressText: { fontSize: 13, color: Colors.textSecondary },
});
