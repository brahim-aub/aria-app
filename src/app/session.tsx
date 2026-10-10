import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, ProgressBar, Row, Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { getExercise } from '@/data/exercises';
import { confirmAction } from '@/lib/confirm';
import type { Exercise, Feeling, Session } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

type Phase = { type: 'work' | 'rest'; stepIndex: number; set: number };

const FEELINGS: { value: Feeling; label: string }[] = [
  { value: 'facile', label: 'Trop facile' },
  { value: 'bien', label: 'Juste bien' },
  { value: 'dur', label: 'Trop dur' },
];

function buildPhases(session: Session): Phase[] {
  const phases: Phase[] = [];
  session.steps.forEach((step, stepIndex) => {
    for (let set = 1; set <= step.sets; set++) {
      phases.push({ type: 'work', stepIndex, set });
      const isLast = stepIndex === session.steps.length - 1 && set === step.sets;
      if (step.restSeconds > 0 && !isLast) phases.push({ type: 'rest', stepIndex, set });
    }
  });
  return phases;
}

/** Compte à rebours d'une phase ; remonté à chaque nouvelle phase grâce à sa `key`. */
function Countdown({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const id = setTimeout(() => {
      if (remaining <= 1) onDone();
      else setRemaining(remaining - 1);
    }, 1000);
    return () => clearTimeout(id);
  }, [remaining, onDone]);

  return <Text style={styles.timer}>{remaining}s</Text>;
}

export default function SessionPlayer() {
  const router = useRouter();
  const session = useAppStore((state) => state.todaySession);
  const recordSession = useAppStore((state) => state.recordSession);

  // Exercices remplacés en cours de séance par une variante plus facile, par étape.
  const [swaps, setSwaps] = useState<Record<number, string>>({});
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [reps, setReps] = useState<Record<string, number>>({});
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  if (!session) return null;

  const phases = buildPhases(session);
  const phase = phases[phaseIndex];
  const exerciseFor = (stepIndex: number): Exercise | undefined =>
    getExercise(swaps[stepIndex] ?? session.steps[stepIndex].exerciseId);

  const finish = (feeling: Feeling) => {
    recordSession({
      sessionId: session.id,
      title: session.title,
      startedAt: startedAt.current,
      feeling,
      reps,
    });
    router.back();
  };

  if (!phase) {
    return (
      <Screen edges={['top', 'bottom']} scroll={false}>
        <View style={styles.center}>
          <Text style={styles.big}>Bravo !</Text>
          <Body muted style={styles.centerText}>
            Séance terminée. Comment tu l&apos;as trouvée ? J&apos;ajusterai la prochaine.
          </Body>
          <Row style={styles.feelings}>
            {FEELINGS.map((item) => (
              <Chip key={item.value} label={item.label} onPress={() => finish(item.value)} />
            ))}
          </Row>
        </View>
      </Screen>
    );
  }

  const step = session.steps[phase.stepIndex];
  const exercise = exerciseFor(phase.stepIndex);
  if (!exercise) return null;
  // Une variante choisie en cours de séance garde ses propres répétitions ou sa durée.
  const amount = swaps[phase.stepIndex] ? exercise.amount : step.amount;

  const next = () => {
    if (phase.type === 'work' && exercise.mode === 'reps') {
      setReps((prev) => ({ ...prev, [exercise.id]: (prev[exercise.id] ?? 0) + amount }));
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhaseIndex((index) => index + 1);
  };

  const makeEasier = () => {
    if (exercise.easierId) setSwaps({ ...swaps, [phase.stepIndex]: exercise.easierId });
  };

  const quit = () =>
    confirmAction(
      'Arrêter la séance ?',
      'Ta progression sur cette séance ne sera pas enregistrée.',
      'Arrêter',
      () => router.back(),
    );

  const nextWork = phases.slice(phaseIndex + 1).find((p) => p.type === 'work');
  const nextExercise = nextWork ? exerciseFor(nextWork.stepIndex) : undefined;

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={quit} hitSlop={12}>
          <Text style={styles.quit}>Quitter</Text>
        </Pressable>
        <Text style={styles.counter}>
          {phaseIndex + 1} / {phases.length}
        </Text>
      </View>
      <ProgressBar value={phaseIndex / phases.length} />

      {phase.type === 'rest' ? (
        <View style={styles.center}>
          <Text style={styles.label}>Repos</Text>
          <Countdown key={phaseIndex} seconds={step.restSeconds} onDone={next} />
          {nextExercise && <Body muted>Ensuite : {nextExercise.name}</Body>}
          <Button label="Passer le repos" variant="secondary" onPress={next} />
        </View>
      ) : (
        <>
          <View style={styles.center}>
            <Text style={styles.label}>
              Série {phase.set} / {step.sets}
            </Text>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {exercise.mode === 'time' ? (
              <Countdown key={`${phaseIndex}-${exercise.id}`} seconds={amount} onDone={next} />
            ) : (
              <Text style={styles.timer}>× {amount}</Text>
            )}
          </View>
          <Card>
            {exercise.instructions.map((line, index) => (
              <Body key={index}>
                {index + 1}. {line}
              </Body>
            ))}
            <Body muted>Pourquoi : {exercise.why}</Body>
          </Card>
          {exercise.mode === 'reps' ? (
            <Button label="C'est fait" onPress={next} />
          ) : (
            <Button label="Terminer maintenant" variant="secondary" onPress={next} />
          )}
          {exercise.easierId && (
            <Button
              label="Trop dur ou douloureux ? Version plus douce"
              variant="ghost"
              onPress={makeEasier}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quit: { fontSize: 16, color: Colors.textSecondary, fontWeight: '600' },
  counter: { fontSize: 15, color: Colors.textSecondary },
  center: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    flexGrow: 1,
    justifyContent: 'center',
  },
  centerText: { textAlign: 'center' },
  label: { fontSize: 16, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  exerciseName: { fontSize: 28, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  timer: { fontSize: 64, fontWeight: '300', color: Colors.text, fontVariant: ['tabular-nums'] },
  big: { fontSize: 36, fontWeight: '700', color: Colors.text },
  feelings: { justifyContent: 'center', marginTop: Spacing.md },
});
