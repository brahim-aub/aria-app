import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, Row, Screen, Title } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getExercise, ZONE_LABELS } from '@/data/exercises';
import { estimateSeconds } from '@/lib/program';
import { currentStreak } from '@/lib/stats';
import type { Zone } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const TIME_OPTIONS = [10, 20, 30, 45];
const ZONES = Object.keys(ZONE_LABELS) as Zone[];

export default function Home() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.todaySession);
  const history = useAppStore((state) => state.history);
  const isGuest = useAppStore((state) => state.isGuest);
  const regenerateSession = useAppStore((state) => state.regenerateSession);

  const [adjusting, setAdjusting] = useState(false);
  const [minutes, setMinutes] = useState<number | undefined>();
  const [pain, setPain] = useState<Zone[]>([]);

  if (!profile || !session) return null;

  const streak = currentStreak(history);
  const estimatedMinutes = Math.max(1, Math.round(estimateSeconds(session.steps) / 60));

  const applyAdjustments = () => {
    regenerateSession({ minutes, extraPainZones: pain, seed: Date.now() });
    setAdjusting(false);
  };

  return (
    <Screen>
      <Title>Salut {profile.firstName} !</Title>

      <Row>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>{streak > 1 ? 'jours d\'affilée' : 'jour d\'affilée'}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{history.length}</Text>
          <Text style={styles.statLabel}>{history.length > 1 ? 'séances' : 'séance'}</Text>
        </View>
      </Row>

      <Card>
        <Text style={styles.cardTitle}>{session.title}</Text>
        <Body muted>
          Environ {estimatedMinutes} min · {session.steps.length} exercices
          {session.avoidedZones.length > 0 &&
            ` · ménage : ${session.avoidedZones.map((z) => ZONE_LABELS[z].toLowerCase()).join(', ')}`}
        </Body>
        <View style={styles.list}>
          {session.steps.map((step, index) => {
            const exercise = getExercise(step.exerciseId);
            if (!exercise) return null;
            const amount = exercise.mode === 'time' ? `${step.amount} s` : `${step.amount} rép.`;
            return (
              <Text key={`${step.exerciseId}-${index}`} style={styles.listItem}>
                {exercise.name} <Text style={styles.listMeta}>· {step.sets} × {amount}</Text>
              </Text>
            );
          })}
        </View>
        <Button label="Commencer la séance" onPress={() => router.push('/session')} />
        <Button
          label={adjusting ? 'Annuler' : 'Adapter ma séance'}
          variant="secondary"
          onPress={() => setAdjusting(!adjusting)}
        />
      </Card>

      {adjusting && (
        <Card>
          <Text style={styles.cardTitle}>Combien de temps aujourd&apos;hui ?</Text>
          <Row>
            {TIME_OPTIONS.map((value) => (
              <Chip
                key={value}
                label={`${value} min`}
                selected={minutes === value}
                onPress={() => setMinutes(minutes === value ? undefined : value)}
              />
            ))}
          </Row>
          <Text style={styles.cardTitle}>Une douleur aujourd&apos;hui ?</Text>
          <Row>
            {ZONES.map((zone) => (
              <Chip
                key={zone}
                label={ZONE_LABELS[zone]}
                selected={pain.includes(zone)}
                onPress={() =>
                  setPain(pain.includes(zone) ? pain.filter((z) => z !== zone) : [...pain, zone])
                }
              />
            ))}
          </Row>
          <Body muted>
            Si une douleur est forte ou dure plusieurs jours, demande l&apos;avis d&apos;un médecin
            ou d&apos;un kiné.
          </Body>
          <Button label="Générer ma séance adaptée" onPress={applyAdjustments} />
        </Card>
      )}

      {isGuest && (
        <View style={styles.banner}>
          <Body style={styles.bannerText}>
            Tu utilises Aria sans compte : ta progression est gardée sur ce téléphone uniquement.
            La création de compte arrive bientôt pour ne rien perdre.
          </Body>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { fontSize: 30, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 14, color: Colors.textSecondary },
  cardTitle: { fontSize: 19, fontWeight: '600', color: Colors.text },
  list: { gap: 6, marginVertical: Spacing.sm },
  listItem: { fontSize: 16, color: Colors.text, fontWeight: '600' },
  listMeta: { color: Colors.textSecondary, fontWeight: '400' },
  banner: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  bannerText: { fontSize: 14, color: Colors.textSecondary },
});
