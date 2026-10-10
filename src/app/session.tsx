import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, ProgressBar, Row, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { getExercise, LEVEL_LABELS } from '@/data/exercises';
import { confirmAction } from '@/lib/confirm';
import { ACHIEVEMENTS } from '@/lib/stats';
import type { Exercise, Feeling, Session } from '@/lib/types';
import { say, stopVoice } from '@/lib/voice';
import { sessionsInWeek } from '@/lib/week';
import { useAppStore, type LevelChange, type SessionSummary } from '@/store/app-store';

type Phase = { type: 'work' | 'rest'; stepIndex: number; set: number };

const FEELINGS: { value: Feeling; label: string }[] = [
  { value: 'facile', label: 'Trop facile' },
  { value: 'bien', label: 'Juste bien' },
  { value: 'dur', label: 'Trop dur' },
];

const PREP_SECONDS = 3;
const KEEP_AWAKE_TAG = 'aria-session';

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

function haptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Compte à rebours ; remonté à chaque phase grâce à sa `key`, il s'arrête pendant la pause. */
function Countdown({
  seconds,
  paused,
  onDone,
  onTick,
  style,
}: {
  seconds: number;
  paused: boolean;
  onDone: () => void;
  onTick?: (remaining: number) => void;
  style?: object;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => {
      if (remaining <= 1) {
        onDone();
      } else {
        onTick?.(remaining - 1);
        setRemaining(remaining - 1);
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [remaining, paused, onDone, onTick]);

  return <Text style={style ?? styles.timer}>{remaining}</Text>;
}

/** Exercice chronométré : 3-2-1 pour se mettre en place, puis le temps de l'exercice. */
function TimedWork({
  seconds,
  paused,
  voice,
  onDone,
}: {
  seconds: number;
  paused: boolean;
  voice: boolean;
  onDone: () => void;
}) {
  const [running, setRunning] = useState(false);

  const announceLast = (remaining: number) => {
    if (voice && remaining <= 3) say(String(remaining));
  };

  if (!running) {
    return (
      <View style={styles.timerBlock}>
        <Text style={styles.prepLabel}>Mets-toi en place</Text>
        <Countdown
          seconds={PREP_SECONDS}
          paused={paused}
          onTick={announceLast}
          onDone={() => {
            if (voice) say('Partez');
            haptic();
            setRunning(true);
          }}
          style={styles.prepTimer}
        />
      </View>
    );
  }

  return (
    <View style={styles.timerBlock}>
      <Countdown seconds={seconds} paused={paused} onTick={announceLast} onDone={onDone} />
      <Text style={styles.unit}>secondes</Text>
    </View>
  );
}

/** Exercice en répétitions : la personne ajuste le nombre réellement fait. */
function RepsWork({ target, onDone }: { target: number; onDone: (done: number) => void }) {
  const [done, setDone] = useState(target);
  return (
    <View style={styles.timerBlock}>
      <View style={styles.repsRow}>
        <Pressable
          accessibilityLabel="Une répétition de moins"
          onPress={() => setDone(Math.max(0, done - 1))}
          style={styles.repsButton}>
          <Text style={styles.repsButtonText}>−</Text>
        </Pressable>
        <Text style={styles.timer}>{done}</Text>
        <Pressable
          accessibilityLabel="Une répétition de plus"
          onPress={() => setDone(done + 1)}
          style={styles.repsButton}>
          <Text style={styles.repsButtonText}>+</Text>
        </Pressable>
      </View>
      <Text style={styles.unit}>répétitions</Text>
      <Button label="C'est fait" onPress={() => onDone(done)} style={styles.fullWidth} />
    </View>
  );
}

export default function SessionPlayer() {
  const router = useRouter();
  const session = useAppStore((state) => state.todaySession);
  const profile = useAppStore((state) => state.profile);
  const history = useAppStore((state) => state.history);
  const voice = useAppStore((state) => state.voiceEnabled);
  const setVoiceEnabled = useAppStore((state) => state.setVoiceEnabled);
  const recordSession = useAppStore((state) => state.recordSession);
  const rateLastSession = useAppStore((state) => state.rateLastSession);
  const track = useAppStore((state) => state.track);

  // Exercices remplacés en cours de séance par une variante plus facile, par étape.
  const [swaps, setSwaps] = useState<Record<number, string>>({});
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reps, setReps] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [levelChange, setLevelChange] = useState<LevelChange | null>(null);
  const startedAt = useRef(0);
  const workDone = useRef(0);

  // L'écran reste allumé pendant toute la séance.
  useEffect(() => {
    startedAt.current = Date.now();
    track('session_started');
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      stopVoice();
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [track]);

  const phases = session ? buildPhases(session) : [];
  const phase = phases[phaseIndex];
  const exerciseFor = (stepIndex: number): Exercise | undefined =>
    session ? getExercise(swaps[stepIndex] ?? session.steps[stepIndex].exerciseId) : undefined;

  // Annonce vocale au début de chaque phase.
  const phaseKey = phase ? `${phaseIndex}-${swaps[phase.stepIndex] ?? ''}` : 'end';
  useEffect(() => {
    if (!voice || !session) return;
    if (!phase) {
      say('Séance terminée. Bravo !');
      return;
    }
    const step = session.steps[phase.stepIndex];
    if (phase.type === 'rest') {
      const nextWork = phases.slice(phaseIndex + 1).find((p) => p.type === 'work');
      const nextExercise = nextWork ? exerciseFor(nextWork.stepIndex) : undefined;
      say(`Repos, ${step.restSeconds} secondes.${nextExercise ? ` Ensuite : ${nextExercise.name}.` : ''}`);
      return;
    }
    const exercise = exerciseFor(phase.stepIndex);
    if (!exercise) return;
    const amount = swaps[phase.stepIndex] ? exercise.amount : step.amount;
    say(
      exercise.mode === 'time'
        ? `${exercise.name}, ${amount} secondes.`
        : `${exercise.name}, ${amount} répétitions.`,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey, voice]);

  if (!session || !profile) return null;

  const finishSession = (partial: boolean) =>
    recordSession({ sessionId: session.id, title: session.title, startedAt: startedAt.current, reps, partial });

  if (!phase) {
    const weekDone = sessionsInWeek(history).length;
    const weekGoal = profile.trainingDays.length;
    const minutes = Math.max(1, Math.round((summary?.durationSeconds ?? 0) / 60));
    const unlocked = ACHIEVEMENTS.filter((a) => summary?.newAchievements.includes(a.id));
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.endHeader}>
          <Text style={styles.big}>Bravo !</Text>
          <Body muted>Séance terminée et enregistrée.</Body>
        </View>
        <Row>
          <View style={styles.endStat}>
            <Text style={styles.endValue}>{minutes} min</Text>
            <Text style={styles.endLabel}>d&apos;effort</Text>
          </View>
          <View style={styles.endStat}>
            <Text style={styles.endValue}>
              {weekDone} / {weekGoal}
            </Text>
            <Text style={styles.endLabel}>séances cette semaine</Text>
          </View>
        </Row>
        {unlocked.length > 0 && (
          <Card style={styles.unlocked}>
            <Text style={styles.sectionTitle}>Succès débloqué{unlocked.length > 1 ? 's' : ''}</Text>
            {unlocked.map((a) => (
              <Body key={a.id}>
                {a.title} · {a.points} pts
              </Body>
            ))}
          </Card>
        )}
        {!feeling ? (
          <Card>
            <Text style={styles.sectionTitle}>Comment tu l&apos;as trouvée ?</Text>
            <Body muted>J&apos;ajusterai la prochaine séance.</Body>
            <Row>
              {FEELINGS.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  onPress={() => {
                    setFeeling(item.value);
                    setLevelChange(rateLastSession(item.value));
                  }}
                />
              ))}
            </Row>
          </Card>
        ) : (
          <Card>
            <Text style={styles.sectionTitle}>Merci, c&apos;est noté.</Text>
            {levelChange ? (
              <Body>
                {levelChange.to > levelChange.from
                  ? `Tu passes au niveau ${LEVEL_LABELS[levelChange.to]} : les prochaines séances proposeront des variantes plus exigeantes.`
                  : `On repasse au niveau ${LEVEL_LABELS[levelChange.to]} : les prochaines séances seront plus douces.`}
              </Body>
            ) : (
              <Body muted>
                {feeling === 'facile'
                  ? 'La prochaine séance sera un peu plus intense.'
                  : feeling === 'dur'
                    ? 'La prochaine séance sera un peu plus douce.'
                    : 'On garde ce rythme.'}
              </Body>
            )}
          </Card>
        )}
        <Button label="Terminer" variant={feeling ? 'primary' : 'secondary'} onPress={() => router.back()} />
      </Screen>
    );
  }

  const step = session.steps[phase.stepIndex];
  const exercise = exerciseFor(phase.stepIndex);
  if (!exercise) return null;
  // Une variante choisie en cours de séance garde ses propres répétitions ou sa durée.
  const amount = swaps[phase.stepIndex] ? exercise.amount : step.amount;

  const next = (repsDone?: number) => {
    if (phase.type === 'work') {
      workDone.current += 1;
      if (exercise.mode === 'reps') {
        const count = repsDone ?? amount;
        setReps((prev) => ({ ...prev, [exercise.id]: (prev[exercise.id] ?? 0) + count }));
      }
    }
    haptic();
    setPaused(false);
    if (phaseIndex + 1 >= phases.length) {
      // On enregistre dès la fin : le ressenti n'est qu'un complément.
      const finalReps =
        phase.type === 'work' && exercise.mode === 'reps'
          ? { ...reps, [exercise.id]: (reps[exercise.id] ?? 0) + (repsDone ?? amount) }
          : reps;
      setSummary(
        recordSession({
          sessionId: session.id,
          title: session.title,
          startedAt: startedAt.current,
          reps: finalReps,
        }),
      );
    }
    setPhaseIndex(phaseIndex + 1);
  };

  const makeEasier = () => {
    if (exercise.easierId) setSwaps({ ...swaps, [phase.stepIndex]: exercise.easierId });
  };

  const quit = () =>
    confirmAction(
      'Arrêter la séance ?',
      workDone.current > 0
        ? 'Ce que tu as déjà fait sera enregistré.'
        : 'Tu n\'as encore fait aucun exercice : rien ne sera enregistré.',
      'Arrêter',
      () => {
        if (workDone.current > 0) finishSession(true);
        router.back();
      },
    );

  const nextWork = phases.slice(phaseIndex + 1).find((p) => p.type === 'work');
  const nextExercise = nextWork ? exerciseFor(nextWork.stepIndex) : undefined;
  const timed = phase.type === 'rest' || exercise.mode === 'time';

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Pressable onPress={quit} hitSlop={12}>
          <Text style={styles.topAction}>Quitter</Text>
        </Pressable>
        <Text style={styles.counter}>
          Exercice {phase.stepIndex + 1} sur {session.steps.length}
        </Text>
        <Pressable
          onPress={() => {
            if (voice) stopVoice();
            setVoiceEnabled(!voice);
          }}
          hitSlop={12}
          accessibilityLabel={voice ? 'Couper la voix' : 'Activer la voix'}>
          <Text style={styles.topAction}>{voice ? 'Voix : oui' : 'Voix : non'}</Text>
        </Pressable>
      </View>
      <ProgressBar value={phaseIndex / phases.length} />

      {phase.type === 'rest' ? (
        <View style={styles.center}>
          <Text style={styles.label}>Repos</Text>
          <View style={styles.timerBlock}>
            <Countdown key={phaseIndex} seconds={step.restSeconds} paused={paused} onDone={next} />
            <Text style={styles.unit}>secondes</Text>
          </View>
          {nextExercise && <Body muted>Ensuite : {nextExercise.name}</Body>}
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={styles.label}>
            Série {phase.set} sur {step.sets}
          </Text>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {exercise.mode === 'time' ? (
            <TimedWork
              key={`${phaseIndex}-${exercise.id}`}
              seconds={amount}
              paused={paused}
              voice={voice}
              onDone={next}
            />
          ) : (
            <RepsWork key={`${phaseIndex}-${exercise.id}`} target={amount} onDone={next} />
          )}
        </View>
      )}

      {timed && (
        <Row style={styles.controls}>
          <Button
            label={paused ? 'Reprendre' : 'Pause'}
            variant="secondary"
            onPress={() => setPaused(!paused)}
            style={styles.flex}
          />
          <Button
            label={phase.type === 'rest' ? 'Passer le repos' : 'Terminer'}
            variant="secondary"
            onPress={() => next()}
            style={styles.flex}
          />
        </Row>
      )}

      {phase.type === 'work' && (
        <>
          <Card>
            {exercise.instructions.map((line, index) => (
              <Body key={index}>
                {index + 1}. {line}
              </Body>
            ))}
            <Body muted>Pourquoi : {exercise.why}</Body>
          </Card>
          {exercise.easierId && (
            <Button label="Trop dur ou douloureux ? Version plus douce" variant="ghost" onPress={makeEasier} />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topAction: { fontSize: 15, color: Colors.textSecondary, fontWeight: '500' },
  counter: { fontSize: 15, color: Colors.text, fontWeight: '600' },
  center: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  label: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  exerciseName: { fontSize: 28, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  timerBlock: { alignItems: 'center', gap: Spacing.xs, alignSelf: 'stretch' },
  timer: { fontSize: 72, fontWeight: '300', color: Colors.text, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, color: Colors.textSecondary },
  prepLabel: { fontSize: 16, color: Colors.textSecondary },
  prepTimer: { fontSize: 72, fontWeight: '300', color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  repsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  repsButton: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repsButtonText: { fontSize: 28, color: Colors.text },
  fullWidth: { alignSelf: 'stretch', marginTop: Spacing.sm },
  controls: { flexWrap: 'nowrap' },
  flex: { flex: 1 },
  endHeader: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg },
  big: { fontSize: 36, fontWeight: '700', color: Colors.text },
  endStat: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  endValue: { fontSize: 24, fontWeight: '600', color: Colors.text, fontVariant: ['tabular-nums'] },
  endLabel: { fontSize: 14, color: Colors.textSecondary },
  unlocked: { borderColor: Colors.accent },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: Colors.text },
});
