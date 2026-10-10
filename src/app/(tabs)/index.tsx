import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, Row, Screen, Title } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getExercise, ZONE_LABELS } from '@/data/exercises';
import { estimateSeconds } from '@/lib/program';
import type { Zone } from '@/lib/types';
import {
  DAY_SHORT,
  daysDoneThisWeek,
  doneToday,
  nextTrainingDayLabel,
  sessionsInWeek,
  WEEK_ORDER,
  weekStreak,
} from '@/lib/week';
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
  const [trainAnyway, setTrainAnyway] = useState(false);
  const [minutes, setMinutes] = useState<number | undefined>();
  const [pain, setPain] = useState<Zone[]>([]);

  if (!profile || !session) return null;

  const today = new Date().getDay();
  const weekGoal = profile.trainingDays.length;
  const weekDone = sessionsInWeek(history).length;
  const streak = weekStreak(history, weekGoal);
  const doneDays = daysDoneThisWeek(history);
  const nextDay = nextTrainingDayLabel(profile.trainingDays);
  const estimatedMinutes = Math.max(1, Math.round(estimateSeconds(session.steps) / 60));
  const status = doneToday(history)
    ? 'done'
    : profile.trainingDays.includes(today)
      ? 'training'
      : 'rest';
  // La toute première séance est proposée tout de suite, même un jour de repos.
  const showSession = status === 'training' || trainAnyway || history.length === 0;

  const applyAdjustments = () => {
    regenerateSession({ minutes, extraPainZones: pain, seed: Date.now() });
    setAdjusting(false);
  };

  return (
    <Screen>
      <Title>Salut {profile.firstName} !</Title>

      <Card>
        <View style={styles.week}>
          {WEEK_ORDER.map((day) => {
            const planned = profile.trainingDays.includes(day);
            const done = doneDays.has(day);
            return (
              <View key={day} style={styles.day}>
                <Text style={[styles.dayLabel, day === today && styles.dayToday]}>{DAY_SHORT[day]}</Text>
                <View
                  style={[styles.dot, planned && styles.dotPlanned, done && styles.dotDone]}
                  accessibilityLabel={done ? 'séance faite' : planned ? 'séance prévue' : 'repos'}
                />
              </View>
            );
          })}
        </View>
        {history.length === 0 ? (
          <Body muted>
            Ta première séance t&apos;attend : environ {estimatedMinutes} minutes, à ton rythme.
          </Body>
        ) : (
          <Body muted>
            {weekDone} séance{weekDone > 1 ? 's' : ''} sur {weekGoal} cette semaine
            {streak > 0 && ` · série de ${streak} semaine${streak > 1 ? 's' : ''} réussie${streak > 1 ? 's' : ''}`}
          </Body>
        )}
      </Card>

      {!showSession && (
        <Card>
          <Text style={styles.cardTitle}>
            {status === 'done' ? 'Séance du jour faite, bravo.' : 'Aujourd\'hui, c\'est repos.'}
          </Text>
          <Body muted>
            {status === 'done'
              ? 'Le repos fait partie du programme : tes muscles se renforcent pendant la récupération.'
              : 'Récupérer est aussi important que s\'entraîner.'}
            {nextDay && ` Prochaine séance : ${nextDay}.`}
          </Body>
          <Button label="M'entraîner quand même" variant="secondary" onPress={() => setTrainAnyway(true)} />
        </Card>
      )}

      {showSession && (
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
              <Link
                key={`${step.exerciseId}-${index}`}
                href={{ pathname: '/exercise/[id]', params: { id: exercise.id } }}
                asChild>
                <Pressable style={styles.listRow}>
                  <Text style={styles.listItem}>
                    {exercise.name} <Text style={styles.listMeta}>· {step.sets} × {amount}</Text>
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
        <Button label="Commencer la séance" onPress={() => router.push('/session')} />
        <Row style={styles.actions}>
          <Button
            label={adjusting ? 'Annuler' : 'Adapter'}
            variant="secondary"
            onPress={() => setAdjusting(!adjusting)}
            style={styles.flex}
          />
          <Button
            label="Modifier"
            variant="secondary"
            onPress={() => router.push('/edit-session')}
            style={styles.flex}
          />
        </Row>
      </Card>
      )}

      {showSession && adjusting && (
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
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 6 },
  dayLabel: { fontSize: 13, color: Colors.textSecondary },
  dayToday: { color: Colors.text, fontWeight: '700' },
  dot: { width: 12, height: 12, borderRadius: Radius.pill, backgroundColor: Colors.surface },
  dotPlanned: { borderWidth: 1.5, borderColor: Colors.text, backgroundColor: Colors.card },
  dotDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  chevron: { fontSize: 20, color: Colors.textSecondary },
  actions: { flexWrap: 'nowrap' },
  flex: { flex: 1 },
  cardTitle: { fontSize: 19, fontWeight: '600', color: Colors.text },
  list: { gap: 6, marginVertical: Spacing.sm },
  listItem: { flexShrink: 1, fontSize: 16, color: Colors.text, fontWeight: '600' },
  listMeta: { color: Colors.textSecondary, fontWeight: '400' },
  banner: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.md },
  bannerText: { fontSize: 14, color: Colors.textSecondary },
});
