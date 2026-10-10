import Ionicons from '@expo/vector-icons/Ionicons';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  CategoryTile,
  type IconName,
  ProgressBar,
  ProgressRing,
  Screen,
} from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { getExercise, LEVEL_LABELS } from '@/data/exercises';
import { confirmAction } from '@/lib/confirm';
import { impact, success, tap } from '@/lib/haptics';
import { ACHIEVEMENTS } from '@/lib/stats';
import type { Exercise, Feeling, Session } from '@/lib/types';
import { say, stopVoice } from '@/lib/voice';
import { sessionsInWeek } from '@/lib/week';
import { useAppStore, type LevelChange, type SessionSummary } from '@/store/app-store';

type Phase = { type: 'work' | 'rest'; stepIndex: number; set: number };

const FEELINGS: { value: Feeling; label: string; icon: IconName }[] = [
  { value: 'facile', label: 'Trop facile', icon: 'happy-outline' },
  { value: 'bien', label: 'Juste bien', icon: 'thumbs-up-outline' },
  { value: 'dur', label: 'Trop dur', icon: 'flame-outline' },
];

const RING_SIZE = 230;

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

/** Compte à rebours ; remonté à chaque phase grâce à sa `key`, il s'arrête pendant la pause. */
function Countdown({
  seconds,
  paused,
  onDone,
  onTick,
  label,
  color = Colors.accent,
}: {
  seconds: number;
  paused: boolean;
  onDone: () => void;
  onTick?: (remaining: number) => void;
  /** Texte sous le chiffre. */
  label: string;
  color?: string;
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

  return (
    <ProgressRing value={remaining / seconds} size={RING_SIZE} stroke={14} color={color} track={Colors.inkSoft}>
      <Text style={styles.timer}>{remaining}</Text>
      <Text style={styles.unit}>{label}</Text>
    </ProgressRing>
  );
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
        <Countdown
          seconds={PREP_SECONDS}
          paused={paused}
          onTick={announceLast}
          label="mets-toi en place"
          color={Colors.textOnDarkMuted}
          onDone={() => {
            if (voice) say('Partez');
            impact();
            setRunning(true);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.timerBlock}>
      <Countdown seconds={seconds} paused={paused} onTick={announceLast} onDone={onDone} label="secondes" />
    </View>
  );
}

/** Exercice en répétitions : la personne ajuste le nombre réellement fait. */
function RepsWork({ target, onDone }: { target: number; onDone: (done: number) => void }) {
  const [done, setDone] = useState(target);
  return (
    <View style={styles.timerBlock}>
      <View style={styles.repsRow}>
        <RoundButton
          icon="remove"
          label="Une répétition de moins"
          onPress={() => setDone(Math.max(0, done - 1))}
        />
        <View style={styles.repsCenter}>
          <Text style={styles.timer}>{done}</Text>
          <Text style={styles.unit}>répétitions</Text>
        </View>
        <RoundButton icon="add" label="Une répétition de plus" onPress={() => setDone(done + 1)} />
      </View>
      <Button
        label="C'est fait"
        icon="checkmark"
        variant="accent"
        onPress={() => onDone(done)}
        style={styles.fullWidth}
      />
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  size = 60,
  primary,
  caption,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  primary?: boolean;
  /** Texte affiché sous le bouton. */
  caption?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        tap();
        onPress();
      }}
      style={styles.control}>
      {({ pressed }) => (
        <>
          <View
            style={[
              styles.round,
              { width: size, height: size },
              primary && styles.roundPrimary,
              pressed && styles.pressed,
            ]}>
            <Ionicons name={icon} size={size * 0.42} color={primary ? Colors.ink : Colors.white} />
          </View>
          {caption && <Text style={styles.controlLabel}>{caption}</Text>}
        </>
      )}
    </Pressable>
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
      <Screen dark edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.endHeader}>
          <View style={styles.endBadge}>
            <Ionicons name="trophy" size={40} color={Colors.ink} />
          </View>
          <Text style={styles.big}>Bravo !</Text>
          <Text style={styles.endSubtitle}>Séance terminée et enregistrée.</Text>
        </View>
        <View style={styles.endStats}>
          <View style={styles.endStat}>
            <Text style={styles.endValue}>{minutes}</Text>
            <Text style={styles.endLabel}>minutes d&apos;effort</Text>
          </View>
          <View style={styles.endStat}>
            <Text style={styles.endValue}>
              {weekDone}/{weekGoal}
            </Text>
            <Text style={styles.endLabel}>séances cette semaine</Text>
          </View>
        </View>
        {unlocked.map((a) => (
          <View key={a.id} style={styles.darkCard}>
            <View style={styles.medal}>
              <Ionicons name="medal" size={22} color={Colors.ink} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.darkEyebrow}>Succès débloqué</Text>
              <Text style={styles.darkTitle}>{a.title}</Text>
            </View>
            <Text style={styles.points}>+{a.points} pts</Text>
          </View>
        ))}
        {!feeling ? (
          <View style={styles.feelingBlock}>
            <Text style={styles.darkTitle}>Comment tu l&apos;as trouvée ?</Text>
            <Text style={styles.darkMuted}>J&apos;ajusterai la prochaine séance.</Text>
            <View style={styles.feelings}>
              {FEELINGS.map((item) => (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  onPress={() => {
                    tap();
                    setFeeling(item.value);
                    setLevelChange(rateLastSession(item.value));
                  }}
                  style={({ pressed }) => [styles.feeling, pressed && styles.feelingPressed]}>
                  <Ionicons name={item.icon} size={26} color={Colors.white} />
                  <Text style={styles.feelingLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.darkCard}>
            <Ionicons
              name={levelChange ? 'trending-up' : 'checkmark-circle'}
              size={26}
              color={Colors.accent}
            />
            <View style={styles.flex}>
              <Text style={styles.darkTitle}>Merci, c&apos;est noté.</Text>
              <Text style={styles.darkMuted}>
                {levelChange
                  ? levelChange.to > levelChange.from
                    ? `Tu passes au niveau ${LEVEL_LABELS[levelChange.to]} : les prochaines séances proposeront des variantes plus exigeantes.`
                    : `On repasse au niveau ${LEVEL_LABELS[levelChange.to]} : les prochaines séances seront plus douces.`
                  : feeling === 'facile'
                    ? 'La prochaine séance sera un peu plus intense.'
                    : feeling === 'dur'
                      ? 'La prochaine séance sera un peu plus douce.'
                      : 'On garde ce rythme.'}
              </Text>
            </View>
          </View>
        )}
        <Button
          label="Terminer"
          variant={feeling ? 'accent' : 'onDark'}
          onPress={() => router.back()}
          style={styles.endButton}
        />
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
    impact();
    setPaused(false);
    if (phaseIndex + 1 >= phases.length) {
      // On enregistre dès la fin : le ressenti n'est qu'un complément.
      const finalReps =
        phase.type === 'work' && exercise.mode === 'reps'
          ? { ...reps, [exercise.id]: (reps[exercise.id] ?? 0) + (repsDone ?? amount) }
          : reps;
      success();
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
    <Screen dark edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <RoundButton icon="close" label="Quitter la séance" onPress={quit} size={42} />
        <Text style={styles.counter}>
          Exercice {phase.stepIndex + 1} / {session.steps.length}
        </Text>
        <RoundButton
          icon={voice ? 'volume-high' : 'volume-mute'}
          label={voice ? 'Couper la voix' : 'Activer la voix'}
          size={42}
          onPress={() => {
            if (voice) stopVoice();
            setVoiceEnabled(!voice);
          }}
        />
      </View>
      <ProgressBar
        value={phaseIndex / phases.length}
        color={Colors.accent}
        track={Colors.inkSoft}
        height={6}
      />

      {phase.type === 'rest' ? (
        <View style={styles.center}>
          <Text style={styles.label}>Repos</Text>
          <Text style={styles.exerciseName}>Respire</Text>
          <View style={styles.timerBlock}>
            <Countdown
              key={phaseIndex}
              seconds={step.restSeconds}
              paused={paused}
              onDone={next}
              label="secondes"
              color={Colors.white}
            />
          </View>
          {nextExercise && (
            <View style={[styles.darkCard, styles.stretch]}>
              <CategoryTile category={nextExercise.category} size={42} />
              <View style={styles.flex}>
                <Text style={styles.darkEyebrow}>Ensuite</Text>
                <Text style={styles.darkTitle}>{nextExercise.name}</Text>
              </View>
            </View>
          )}
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
        <View style={styles.controls}>
          <RoundButton
            icon={paused ? 'play' : 'pause'}
            label={paused ? 'Reprendre' : 'Pause'}
            caption={paused ? 'Reprendre' : 'Pause'}
            onPress={() => setPaused(!paused)}
            size={72}
            primary
          />
          <RoundButton
            icon="play-skip-forward"
            label={phase.type === 'rest' ? 'Passer le repos' : 'Terminer'}
            caption={phase.type === 'rest' ? 'Passer le repos' : 'Terminer'}
            onPress={() => next()}
            size={72}
          />
        </View>
      )}

      {phase.type === 'work' && (
        <>
          <View style={styles.instructions}>
            {exercise.instructions.map((line, index) => (
              <View key={index} style={styles.instructionRow}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.instructionText}>{line}</Text>
              </View>
            ))}
            <Text style={styles.darkMuted}>Pourquoi : {exercise.why}</Text>
          </View>
          {exercise.easierId && (
            <Button
              label="Trop dur ou douloureux ? Version plus douce"
              icon="trending-down"
              variant="onDark"
              size="sm"
              onPress={makeEasier}
            />
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stretch: { alignSelf: 'stretch' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.white },
  center: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  label: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  exerciseName: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: Fonts.extrabold,
    color: Colors.white,
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: Spacing.sm,
  },
  timerBlock: { alignItems: 'center', gap: Spacing.md, alignSelf: 'stretch' },
  timer: { fontSize: 72, lineHeight: 80, fontFamily: Fonts.extrabold, color: Colors.white, fontVariant: ['tabular-nums'] },
  unit: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.textOnDarkMuted },
  repsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingVertical: Spacing.lg },
  repsCenter: { alignItems: 'center', minWidth: 120 },
  round: {
    borderRadius: Radius.pill,
    backgroundColor: Colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundPrimary: { backgroundColor: Colors.accent },
  fullWidth: { alignSelf: 'stretch' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl },
  control: { alignItems: 'center', gap: 6 },
  controlLabel: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textOnDarkMuted },
  instructions: { backgroundColor: Colors.inkSoft, borderRadius: Radius.lg, padding: Spacing.md, gap: Spacing.sm + 2 },
  instructionRow: { flexDirection: 'row', gap: Spacing.sm + 2, alignItems: 'flex-start' },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  instructionNumberText: { fontSize: 13, fontFamily: Fonts.extrabold, color: Colors.ink },
  instructionText: { flex: 1, fontSize: 15, lineHeight: 22, fontFamily: Fonts.regular, color: Colors.white },
  darkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.inkSoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  darkEyebrow: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textOnDarkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  darkTitle: { fontSize: 17, lineHeight: 23, fontFamily: Fonts.bold, color: Colors.white },
  darkMuted: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.regular, color: Colors.textOnDarkMuted },
  endHeader: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  endBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  big: { fontSize: 40, lineHeight: 46, fontFamily: Fonts.extrabold, color: Colors.white, letterSpacing: -1 },
  endSubtitle: { fontSize: 16, fontFamily: Fonts.regular, color: Colors.textOnDarkMuted },
  endStats: { flexDirection: 'row', gap: Spacing.sm + 2 },
  endStat: { flex: 1, backgroundColor: Colors.inkSoft, borderRadius: Radius.lg, padding: Spacing.md, gap: 2 },
  endValue: { fontSize: 32, lineHeight: 38, fontFamily: Fonts.extrabold, color: Colors.accent, fontVariant: ['tabular-nums'] },
  endLabel: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textOnDarkMuted },
  medal: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  points: { fontSize: 15, fontFamily: Fonts.extrabold, color: Colors.accent },
  feelingBlock: { gap: Spacing.xs, marginTop: Spacing.sm },
  feelings: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  feeling: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.inkSoft,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md + 2,
    borderWidth: 1,
    borderColor: Colors.borderOnDark,
  },
  feelingPressed: { backgroundColor: Colors.borderOnDark },
  feelingLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Colors.white },
  endButton: { marginTop: Spacing.sm },
});
