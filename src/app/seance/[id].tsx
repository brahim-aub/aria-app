import { EditorialCard, workoutImage } from '@/components/brand';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDayActions } from '@/components/DayActions';
import { ExerciseDemo } from '@/components/ExerciseDemo';
import { ExerciseRow, Notice, Tag } from '@/components/kit';
import { Button, Card, H1, H2, IconButton, Muted, RatingPicker, Stat } from '@/components/ui';
import { EXERCISES, exerciseName, musclesLabel } from '@/data/exercises';
import { getPreset } from '@/data/presets';
import { confirmAction, notify } from '@/lib/confirm';
import { dateKey, formatClock, relativeDay } from '@/lib/date';
import { activeAvoid, getDay } from '@/lib/schedule';
import { endCue, useCountdownCues, useNow } from '@/lib/timer';
import { adaptSession, buildSteps, estimateKcal, estimateMinutes, Step, stepSeconds, WorkStep } from '@/lib/workout';
import { useApp } from '@/store/AppStore';
import { useSessionDraft } from '@/store/SessionDraftStore';
import { resumeSessionClock, type SessionDetails, type SessionDraft } from '@/lib/sessionDraft';
import type { AppData, SetLog } from '@/store/types';
import { colors, font, radius, spacing, tints } from '@/theme';

type Phase = 'intro' | 'running' | 'done';

const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));

const isTimed = (s: Step) => s.type === 'rest' || s.mode === 'time';
const amountLabel = (s: WorkStep) => (s.mode === 'time' ? `${s.amount} s` : `${s.amount} reps`);

type Resolved = SessionDetails;

function resolve(id: string, data: AppData): Resolved | undefined {
  const today = dateKey();
  const ctx = { equipment: data.profile.equipment, avoid: activeAvoid(data, today) };
  if (id.startsWith('d-')) {
    const date = id.slice(2);
    const day = getDay(data, date);
    if (!day.session) return undefined;
    const notes = [...(day.modified && day.reason ? [day.reason] : []), ...day.adaptations.map((a) => `Adapté : ${a}`)];
    return { session: day.session, kicker: relativeDay(date), scheduledDate: date, notes, dayStatus: day };
  }
  const base = id.startsWith('p-') ? getPreset(id.slice(2)) : id.startsWith('c-') ? data.customSessions.find((c) => c.id === id.slice(2)) : undefined;
  if (!base) return undefined;
  const { session, changes } = adaptSession(base, ctx);
  return { session, kicker: id.startsWith('p-') ? 'Séance prête' : 'Ma séance', notes: changes.map((c) => `Adapté : ${c}`) };
}

export default function SessionPlayer() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, addLog } = useApp();
  const dayActions = useDayActions();
  const { draft, ready: draftReady, error: draftError, saveDraft, discardDraft } = useSessionDraft();
  // La séance est figée au lancement de l'écran : elle ne bouge plus pendant l'effort.
  const [resolved, setResolved] = useState(() => resolve(String(id), data));
  const session = resolved?.session;
  const [steps, setSteps] = useState(() => resolved ? buildSteps(resolved.session, activeAvoid(data, dateKey())) : []);

  const [phase, setPhase] = useState<Phase>('intro');
  const [index, setIndex] = useState(0);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [finishedAt, setFinishedAt] = useState(0);
  const [difficulty, setDifficulty] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [note, setNote] = useState('');
  /** Résultats réels, par index d'étape. */
  const [results, setResults] = useState<Record<number, SetLog>>({});
  const [draftReps, setDraftReps] = useState(0);
  const [draftWeight, setDraftWeight] = useState(0);
  const resultsRef = useRef<Record<number, SetLog>>({});

  const draftCleared = useRef(false);
  const logWritten = useRef(false);
  const [saving, setSaving] = useState(false);
  const snapshotRef = useRef<(() => SessionDraft | null) | null>(null);

  const captureDraft = useCallback((): SessionDraft | null => {
    if (!resolved || phase === 'intro') return null;
    const currentTime = Date.now();
    return {
      version: 1, routeId: String(id), resolved, steps, phase, index,
      remainingMs: phase === 'running' && endAt != null
        ? pausedLeft ?? Math.max(0, endAt - currentTime) : null,
      elapsedMs: Math.max(0, (phase === 'done' ? finishedAt : currentTime) - startedAt),
      results, draftReps, draftWeight, difficulty, energy, note,
    };
  }, [resolved, phase, id, steps, index, endAt, pausedLeft, finishedAt, startedAt,
    results, draftReps, draftWeight, difficulty, energy, note]);

  useEffect(() => {
    snapshotRef.current = captureDraft;
    const next = captureDraft();
    if (draftReady && next && !draftCleared.current) saveDraft(next);
  }, [captureDraft, draftReady, saveDraft]);

  useEffect(() => {
    if (phase !== 'running' || !draftReady) return;
    const checkpoint = () => {
      const next = snapshotRef.current?.();
      if (next && !draftCleared.current) saveDraft(next);
    };
    const timer = setInterval(checkpoint, 1000);
    const listener = AppState.addEventListener('change', checkpoint);
    if (Platform.OS === 'web') window.addEventListener('pagehide', checkpoint);
    return () => {
      clearInterval(timer);
      listener.remove();
      if (Platform.OS === 'web') window.removeEventListener('pagehide', checkpoint);
    };
  }, [phase, draftReady, saveDraft]);

  const discard = useCallback(async () => {
    draftCleared.current = true;
    try {
      await discardDraft();
      return true;
    } catch {
      draftCleared.current = false;
      notify('Sauvegarde indisponible', 'Impossible de retirer le brouillon. Réessaie avant de quitter.');
      return false;
    }
  }, [discardDraft]);

  const step = steps[index];
  const timed = !!step && isTimed(step);
  const paused = pausedLeft != null;
  const now = useNow(phase === 'running');
  const remainingMs = phase !== 'running' || !timed ? null : paused ? pausedLeft : endAt ? endAt - now : null;
  useCountdownCues(remainingMs == null || paused ? null : remainingMs / 1000);

  const goTo = useCallback(
    (i: number) => {
      if (i >= steps.length) {
        setPhase('done');
        setFinishedAt(Date.now());
        setEndAt(null);
        setPausedLeft(null);
        return;
      }
      const s = steps[Math.max(0, i)];
      setIndex(Math.max(0, i));
      // Pré-remplit répétitions et charge, en reprenant la dernière charge utilisée sur cet exercice.
      if (s.type === 'work' && s.mode === 'reps') {
        const done = resultsRef.current;
        const prev = done[i];
        const lastWeight = Object.entries(done)
          .filter(([k]) => (steps[Number(k)] as WorkStep | undefined)?.exerciseId === s.exerciseId)
          .map(([, r]) => r.weightKg)
          .filter((w): w is number => w != null)
          .pop();
        setDraftReps(prev?.reps ?? s.amount);
        setDraftWeight(prev?.weightKg ?? lastWeight ?? s.weightKg ?? 0);
      }
      setPausedLeft(null);
      setEndAt(isTimed(s) ? Date.now() + stepSeconds(s) * 1000 : null);
    },
    [steps],
  );

  const record = useCallback((i: number, r: SetLog) => {
    resultsRef.current = { ...resultsRef.current, [i]: r };
    setResults(resultsRef.current);
  }, []);

  // Passage automatique à l'étape suivante à la fin d'une étape chronométrée.
  useEffect(() => {
    if (phase !== 'running' || !timed || paused || endAt == null) return;
    const t = setTimeout(
      () => {
        endCue();
        if (step?.type === 'work' && step.phase === 'main') record(index, { seconds: step.amount });
        goTo(index + 1);
      },
      Math.max(0, endAt - Date.now()),
    );
    return () => clearTimeout(t);
  }, [phase, timed, paused, endAt, index, goTo, step, record]);

  const confirmQuit = useCallback(() => {
    if (phase !== 'running') {
      leave();
      return;
    }
    if (Platform.OS === 'web') {
      // Sur le web, pas de boîte à trois choix : on propose de terminer ici ; l'écran de fin permet de ne pas enregistrer.
      void confirmAction('Arrêter la séance ?', 'Tu pourras enregistrer ce que tu as déjà fait, ou ne pas l’enregistrer.', 'Terminer ici').then((ok) => {
        if (ok) goTo(steps.length);
      });
      return;
    }
    Alert.alert('Arrêter la séance ?', 'Tu peux enregistrer ce que tu as déjà fait.', [
      { text: 'Continuer', style: 'cancel' },
      { text: 'Terminer ici', onPress: () => goTo(steps.length) },
      { text: 'Abandonner', style: 'destructive', onPress: () => { void discard().then((ok) => { if (ok) leave(); }); } },
    ]);
  }, [phase, goTo, steps.length, discard]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmQuit();
      return true;
    });
    return () => sub.remove();
  }, [confirmQuit]);


  if (!draftReady) {
    return <SafeAreaView style={styles.safe}><ActivityIndicator accessibilityLabel="Lecture de ta séance sauvegardée" /></SafeAreaView>;
  }

  if (phase === 'intro' && draft) {
    const resume = () => {
      if (draft.routeId !== String(id)) {
        router.replace(`/seance/${draft.routeId}`);
        return;
      }
      const clock = resumeSessionClock(draft, Date.now());
      setResolved(draft.resolved);
      setSteps(draft.steps);
      setIndex(draft.index);
      resultsRef.current = draft.results;
      setResults(draft.results);
      setDraftReps(draft.draftReps);
      setDraftWeight(draft.draftWeight);
      setDifficulty(draft.difficulty);
      setEnergy(draft.energy);
      setNote(draft.note);
      setStartedAt(clock.startedAt);
      setFinishedAt(clock.finishedAt);
      setEndAt(draft.remainingMs === null ? null : Date.now() + draft.remainingMs);
      setPausedLeft(clock.pausedLeft);
      setPhase(draft.phase);
    };
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <IconButton icon="close" label="Fermer" onPress={leave} />
          <H1>Séance à reprendre</H1>
          <H2>{draft.resolved.session.title}</H2>
          <Muted>{Object.keys(draft.results).length} série(s) conservée(s) · {formatClock(draft.elapsedMs / 1000)} d’entraînement</Muted>
          <Muted>{draft.phase === 'done'
            ? 'Ta séance est terminée. Tu peux retrouver le bilan et l’enregistrer.'
            : 'Reprends où tu en étais. Le chronomètre attendra que tu sois prêt.'}</Muted>
          <Button title="Reprendre la séance" icon="play" big onPress={resume} />
          <Button title="Abandonner cette séance" variant="ghost" onPress={async () => {
            if (await confirmAction('Abandonner cette séance ?', 'Les séries de ce brouillon ne seront pas enregistrées dans ton journal.', 'Abandonner', true)) {
              await discard();
            }
          }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!session || !resolved) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          <H1>Séance introuvable</H1>
          <Button title="Retour" onPress={() => leave()} />
        </View>
      </SafeAreaView>
    );
  }

  const estMin = estimateMinutes(session);
  const estKcal = estimateKcal(session, data.profile.weightKg);

  const start = () => {
    draftCleared.current = false;
    setStartedAt(Date.now());
    setPhase('running');
    goTo(0);
  };

  const togglePause = () => {
    if (paused) {
      setEndAt(Date.now() + (pausedLeft ?? 0));
      setPausedLeft(null);
    } else if (endAt != null) {
      setPausedLeft(Math.max(0, endAt - Date.now()));
    }
  };

  const addTime = (sec: number) => {
    if (paused) setPausedLeft((p) => (p ?? 0) + sec * 1000);
    else setEndAt((e) => (e ?? Date.now()) + sec * 1000);
  };

  const summary = () => {
    const byEx = new Map<string, SetLog[]>();
    Object.entries(results).forEach(([k, r]) => {
      const s = steps[Number(k)];
      if (s?.type !== 'work') return;
      byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), r]);
    });
    const exercises = [...byEx.entries()].map(([exerciseId, sets]) => ({ exerciseId, sets }));
    const volumeKg = Math.round(exercises.reduce((sum, e) => sum + e.sets.reduce((s, x) => s + (x.reps ?? 0) * (x.weightKg ?? 0), 0), 0));
    const minutes = Math.max(1, Math.round((finishedAt - startedAt) / 60000));
    const kcal = Math.round(estKcal * Math.min(1.5, Math.max(0.3, minutes / Math.max(1, estMin))));
    const setsDone = exercises.reduce((s, e) => s + e.sets.length, 0);
    return { exercises, volumeKg, minutes, kcal, setsDone };
  };

  // ───────── Intro ─────────
  if (phase === 'intro') {
    const day = resolved.dayStatus;
    const alreadyDone = day?.status === 'done';
    return (
      <SafeAreaView style={styles.safe}>
        {dayActions.element}
        <View style={styles.topBar}>
          <IconButton icon="close" label="Fermer" onPress={() => leave()} />
          <View style={{ flex: 1 }} />
          {day && !alreadyDone && <IconButton icon="ellipsis-horizontal" label="Options" onPress={() => dayActions.open(day)} />}
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          {draftError && <Notice tone="warning"><Muted>{draftError}</Muted></Notice>}
          <EditorialCard kicker={resolved.kicker} image={workoutImage(session.title)} title={session.title} subtitle={session.focus || "Un moment pour toi. Exercice après exercice."} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Stat value={`~${estMin}`} label="minutes" accent />
            <Stat value={`${session.exercises.length}`} label="exercices" />
            <Stat value={`~${estKcal}`} label="kcal" />
          </View>
          {resolved.notes.length > 0 && (
            <Card style={{ borderColor: colors.violet, backgroundColor: colors.violetDim }}>
              {resolved.notes.map((n, i) => (
                <View key={i} style={styles.cueRow}>
                  <Ionicons name="sparkles" size={16} color={colors.violet} />
                  <Text style={styles.cueText}>{n}</Text>
                </View>
              ))}
            </Card>
          )}
          <Card>
            <View style={styles.rowBetween}>
              <H2>Déroulé</H2>
              <Tag label={session.format === 'circuit' ? 'Circuit' : 'Séries'} color={session.format === 'circuit' ? colors.rest : colors.cyan} />
            </View>
            {session.warmup && <Muted>Échauffement guidé ~{estMin < 15 ? 2 : 3} min</Muted>}
            {session.exercises.map((e, i) => (
              <ExerciseRow key={i} e={e} index={i} />
            ))}
            {session.cooldown && <Muted>Étirements ~{estMin < 15 ? 1 : 3} min</Muted>}
          </Card>
          <Muted style={{ fontSize: 12 }}>
            Chaque exercice a une version plus facile : utilise-la sans hésiter. Une douleur vive (pas juste de la fatigue) = on arrête et on le dit au coach.
          </Muted>
        </ScrollView>
        <View style={styles.footer}>
          {alreadyDone ? <Muted style={{ textAlign: 'center' }}>Séance déjà faite aujourd’hui 💪</Muted> : <Button title="Commencer ma séance" icon="play" big onPress={start} />}
        </View>
      </SafeAreaView>
    );
  }

  // ───────── Fin ─────────
  if (phase === 'done') {
    const sum = summary();
    const save = async () => {
      if (saving) return;
      setSaving(true);
      if (!logWritten.current) addLog({
        kind: 'program',
        scheduledDate: resolved.scheduledDate,
        title: session.title,
        durationMin: sum.minutes,
        difficulty,
        energy,
        note: note.trim() || undefined,
        exercises: sum.exercises,
        volumeKg: sum.volumeKg,
        kcal: sum.kcal,
      });
      logWritten.current = true;
      if (await discard()) leave();
      else setSaving(false);
    };
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <Ionicons name="trophy" size={64} color={colors.yellow} />
            <H1>Séance terminée !</H1>
            <Muted>Chaque séance compte. Tu viens d&apos;en ajouter une.</Muted>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Stat value={`${sum.minutes}`} label="minutes" accent />
            <Stat value={`${sum.setsDone}`} label="séries" />
            <Stat value={`${sum.kcal}`} label="kcal" />
          </View>
          {sum.volumeKg > 0 && (
            <Card style={{ alignItems: 'center' }}>
              <Text style={styles.volume}>{sum.volumeKg.toLocaleString('fr-FR')} kg</Text>
              <Muted>soulevés pendant la séance</Muted>
            </Card>
          )}
          <Card>
            <H2>C&apos;était comment ?</H2>
            <RatingPicker kind="difficulty" value={difficulty} onChange={setDifficulty} />
          </Card>
          <Card>
            <H2>Ton énergie après la séance</H2>
            <RatingPicker kind="energy" value={energy} onChange={setEnergy} />
          </Card>
          <Card>
            <H2>Une note ?</H2>
            <TextInput value={note} onChangeText={setNote} placeholder="Ex : pompes difficiles, genou OK…" placeholderTextColor={colors.muted} style={styles.input} multiline />
            <Muted style={{ fontSize: 12 }}>Le coach lit tes notes pour ajuster la suite.</Muted>
          </Card>
          <Button title="Enregistrer" icon="checkmark" big onPress={save} loading={saving} disabled={saving} />
          <Button
            title="Ne pas enregistrer"
            variant="ghost"
            onPress={() =>
              void confirmAction('Ne pas enregistrer ?', 'La séance ne comptera pas dans ta progression.', 'Confirmer', true).then((ok) => {
                if (ok) void discard().then((removed) => { if (removed) leave(); });
              })
            }
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ───────── En cours ─────────
  const isRest = step.type === 'rest';
  const accent = isRest ? colors.rest : step.phase === 'main' ? colors.accentInk : colors.cyan;
  const nextWork = steps.slice(index + 1).find((s): s is WorkStep => s.type === 'work');
  const exercise = step.type === 'work' ? EXERCISES[step.exerciseId] : undefined;
  const total = timed ? stepSeconds(step) : 0;
  const ratio = timed && remainingMs != null ? Math.min(1, Math.max(0, 1 - remainingMs / 1000 / total)) : 0;
  const phaseLabel =
    step.type === 'rest'
      ? step.label
      : step.phase === 'warmup'
        ? 'Échauffement'
        : step.phase === 'cooldown'
          ? 'Retour au calme'
          : session.format === 'circuit'
            ? `Tour ${step.set} sur ${step.sets}`
            : `Série ${step.set} sur ${step.sets}`;
  const loaded = !!exercise?.loaded && step.type === 'work' && step.mode === 'reps';

  const finishRepsStep = () => {
    if (step.type === 'work' && step.phase === 'main') record(index, { reps: draftReps, weightKg: loaded && draftWeight ? draftWeight : undefined });
    endCue();
    goTo(index + 1);
  };

  return (
    <SafeAreaView style={[styles.safe, isRest && { backgroundColor: tints.orange }]}>
      <View style={styles.topBar}>
        <IconButton icon="close" label="Quitter la séance" onPress={confirmQuit} />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((index + 1) / steps.length) * 100}%`, backgroundColor: accent }]} />
        </View>
        <Text style={styles.elapsed}>{formatClock((now - startedAt) / 1000)}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, styles.runningColumn]} keyboardShouldPersistTaps="handled">
        {draftError && <Notice tone="warning"><Muted>{draftError}</Muted></Notice>}
        <Text style={[styles.kicker, { color: accent }]}>{phaseLabel}</Text>
        <H1>{isRest ? 'Repos' : exercise?.name}</H1>
        {exercise && <Muted>{musclesLabel(exercise)}</Muted>}
        <View style={styles.effortCard}>
          <View style={styles.effortRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.effortLabel}>{timed ? paused ? 'EN PAUSE' : isRest ? 'RÉCUPÉRATION' : 'TEMPS RESTANT' : 'CETTE SÉRIE'}</Text>
              <Text style={[styles.effortValue, { color: accent }]}>{timed ? formatClock((remainingMs ?? 0) / 1000) : draftReps}<Text style={styles.effortUnit}>{timed ? '' : ' répétitions'}</Text></Text>
            </View>
            <Ionicons name={timed ? paused ? 'pause-circle-outline' : 'timer-outline' : 'repeat-outline'} size={26} color={accent} />
          </View>
          {timed && <View style={styles.stepTrack}><View style={[styles.stepFill, { width: `${ratio * 100}%`, backgroundColor: accent }]} /></View>}
        </View>
        {step.type === 'work' && <ExerciseDemo key={step.exerciseId} exerciseId={step.exerciseId} active={!paused} />}

        {!timed && step.type === 'work' && step.phase === 'main' && (
          <View style={styles.adjustRow}>
            <Adjust label="Reps faites" value={draftReps} onChange={setDraftReps} step={1} />
            {loaded && <Adjust label="Charge (kg)" value={draftWeight} onChange={setDraftWeight} step={2.5} />}
          </View>
        )}

        {isRest && nextWork && (
          <Card style={{ backgroundColor: colors.restDim, borderColor: 'transparent' }}>
            <Muted style={{ fontSize: 12 }}>ENSUITE</Muted>
            <H2>
              {exerciseName(nextWork.exerciseId)} · {amountLabel(nextWork)}
            </H2>
            {EXERCISES[nextWork.exerciseId]?.cues[0] && <Muted>{EXERCISES[nextWork.exerciseId].cues[0]}</Muted>}
            <ExerciseDemo key={nextWork.exerciseId} exerciseId={nextWork.exerciseId} compact active={!paused} />
          </Card>
        )}

        {exercise && (
          <Card>
            {exercise.cues.map((c, i) => (
              <View key={i} style={styles.cueRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.accentInk} />
                <Text style={styles.cueText}>{c}</Text>
              </View>
            ))}
            {exercise.easier && (
              <View style={[styles.cueRow, { marginTop: spacing.xs }]}>
                <Ionicons name="leaf-outline" size={18} color={colors.rest} />
                <Text style={[styles.cueText, { color: colors.muted }]}>Trop dur ? {exercise.easier}</Text>
              </View>
            )}
          </Card>
        )}
      </ScrollView>

      <View style={styles.controls}>
        <IconButton icon="play-skip-back" label="Étape précédente" onPress={() => goTo(index - 1)} />
        {timed ? (
          <Button title={paused ? 'Reprendre' : 'Pause'} icon={paused ? 'play' : 'pause'} variant="secondary" onPress={togglePause} style={{ flex: 1 }} />
        ) : (
          <Button title="Série faite" icon="checkmark" onPress={finishRepsStep} style={{ flex: 1 }} />
        )}
        {isRest ? <IconButton icon="add" label="Ajouter 15 secondes" onPress={() => addTime(15)} /> : null}
        <IconButton icon="play-skip-forward" label="Étape suivante" onPress={() => goTo(index + 1)} />
      </View>
    </SafeAreaView>
  );
}

function Adjust({ label, value, onChange, step }: { label: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <View style={styles.adjust}>
      <Text style={styles.adjustLabel}>{label}</Text>
      <View style={styles.adjustInner}>
        <Pressable accessibilityRole="button" accessibilityLabel={"Diminuer " + label.toLowerCase()} style={styles.adjustButton} onPress={() => onChange(Math.max(0, Math.round((value - step) * 10) / 10))}>
          <Ionicons name="remove-circle" size={30} color={colors.muted} />
        </Pressable>
        <Text style={styles.adjustValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={"Augmenter " + label.toLowerCase()} style={styles.adjustButton} onPress={() => onChange(Math.round((value + step) * 10) / 10)}>
          <Ionicons name="add-circle" size={30} color={colors.accentInk} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  runningColumn: { width: '100%', maxWidth: 640, alignSelf: 'center', flexGrow: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%' },
  elapsed: { color: colors.muted, fontVariant: ['tabular-nums'], fontFamily: font.bold, minWidth: 44, textAlign: 'right' },
  kicker: { color: colors.accentInk, fontSize: 15, fontFamily: font.black },
  footer: { padding: spacing.md },
  effortCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 12 },
  effortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  effortLabel: { color: colors.muted, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.1 },
  effortValue: { fontSize: 38, lineHeight: 44, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  effortUnit: { color: colors.muted, fontSize: 15, fontFamily: font.bold },
  stepTrack: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  stepFill: { height: '100%' },
  adjustRow: { flexDirection: 'row', gap: spacing.sm },
  adjust: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm, alignItems: 'center', gap: 4 },
  adjustLabel: { color: colors.muted, fontSize: 12, fontFamily: font.bold },
  adjustInner: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 2 },
  adjustButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  adjustValue: { color: colors.text, fontSize: 22, fontFamily: font.black, flex: 1, minWidth: 0, textAlign: 'center', fontVariant: ['tabular-nums'] },
  cueRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  cueText: { fontFamily: font.regular, color: colors.text, fontSize: 15, flex: 1, lineHeight: 21 },
  volume: { color: colors.violet, fontSize: 32, fontFamily: font.black },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  input: { fontFamily: font.regular, color: colors.text, backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.md, minHeight: 70, textAlignVertical: 'top', fontSize: 15 },
});
