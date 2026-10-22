import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseList } from '@/components/ExerciseList';
import { EmptyState, Field, Tag } from '@/components/kit';
import { Button, Chip, IconButton, Muted, Screen } from '@/components/ui';
import { EXERCISES } from '@/data/exercises';
import { confirmAction } from '@/lib/confirm';
import { relativeDay } from '@/lib/date';
import { focusRing, PressState } from '@/lib/motion';
import { estimateKcal, estimateMinutes, newId } from '@/lib/workout';
import { useApp } from '@/store/AppStore';
import type { SessionExercise, WorkoutSession } from '@/store/types';
import { colors, radius, spacing, font } from '@/theme';

export default function CreerSeance() {
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { data, saveCustomSession, replaceDay } = useApp();
  const existing = data.customSessions.find((s) => s.id === id);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [format, setFormat] = useState<'sets' | 'circuit'>(existing?.format ?? 'sets');
  const [warmup, setWarmup] = useState(existing?.warmup ?? true);
  const [exercises, setExercises] = useState<SessionExercise[]>(existing?.exercises ?? []);
  const [picking, setPicking] = useState(false);

  const session: WorkoutSession = {
    id: existing?.id ?? newId(),
    title: title.trim() || 'Ma séance',
    warmup,
    cooldown: true,
    format,
    exercises,
    source: 'custom',
  };

  const toggle = (exId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setExercises((cur) => {
      if (cur.some((e) => e.exerciseId === exId)) return cur.filter((e) => e.exerciseId !== exId);
      const ex = EXERCISES[exId];
      return [...cur, { exerciseId: exId, sets: 3, reps: ex.mode === 'reps' ? 10 : undefined, seconds: ex.mode === 'time' ? 30 : undefined, restSec: 45 }];
    });
  };

  const patch = (i: number, p: Partial<SessionExercise>) => setExercises((cur) => cur.map((e, k) => (k === i ? { ...e, ...p } : e)));
  const move = (i: number, dir: -1 | 1) =>
    setExercises((cur) => {
      const j = i + dir;
      if (j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = () => {
    saveCustomSession(session);
    if (date) {
      replaceDay(date, { ...session, id: newId() }, `Ta séance : ${session.title}`);
      router.dismissAll();
      return;
    }
    void confirmAction('Séance enregistrée', 'Tu la retrouves dans « Mes séances ». Tu veux la commencer maintenant ?', 'Commencer').then((ok) => {
      if (ok) router.replace(`/seance/c-${session.id}`);
      else router.back();
    });
  };

  return (
    <Screen top={false}>
      {date && <Muted>Cette séance sera planifiée pour {relativeDay(date).toLowerCase()}.</Muted>}
      <Field label="Nom de la séance" value={title} onChangeText={setTitle} placeholder="Ex : Bras du mardi" />

      <View style={styles.row}>
        <Chip label="Séries classiques" active={format === 'sets'} onPress={() => setFormat('sets')} />
        <Chip label="Circuit" active={format === 'circuit'} onPress={() => setFormat('circuit')} />
        <Chip label="Avec échauffement" active={warmup} onPress={() => setWarmup(!warmup)} />
      </View>
      <Muted style={{ fontSize: 12 }}>
        {format === 'sets' ? 'Toutes les séries d’un exercice, puis le suivant.' : 'Un tour de chaque exercice, puis on recommence (nombre de tours = séries).'}
      </Muted>

      {exercises.length > 0 && (
        <View style={styles.row}>
          <Tag label={`~${estimateMinutes(session)} min`} color={colors.text} icon="time-outline" />
          <Tag label={`~${estimateKcal(session, data.profile.weightKg)} kcal`} color={colors.text} icon="flame-outline" />
          <Tag label={`${exercises.length} exercice${exercises.length > 1 ? 's' : ''}`} color={colors.text} icon="barbell-outline" />
        </View>
      )}

      {exercises.length === 0 ? (
        <View style={styles.emptyBox}>
          <EmptyState icon="add-circle-outline" title="Ajoute tes exercices" text="Pioche dans la bibliothèque, puis règle séries, répétitions et repos." />
        </View>
      ) : (
        exercises.map((e, i) => {
          const ex = EXERCISES[e.exerciseId];
          const timed = ex?.mode === 'time';
          return (
            <View key={e.exerciseId} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.index}>{i + 1}</Text>
                <Text style={styles.name} numberOfLines={2}>
                  {ex?.name ?? e.exerciseId}
                </Text>
                <IconButton icon="chevron-up" size={18} label={`Monter ${ex?.name ?? ''}`} onPress={() => move(i, -1)} />
                <IconButton icon="chevron-down" size={18} label={`Descendre ${ex?.name ?? ''}`} onPress={() => move(i, 1)} />
                <IconButton icon="close" size={18} color={colors.danger} label={`Retirer ${ex?.name ?? ''}`} onPress={() => setExercises((cur) => cur.filter((_, k) => k !== i))} />
              </View>
              <View style={styles.params}>
                <Mini label={format === 'circuit' ? 'Tours' : 'Séries'} value={e.sets} onChange={(v) => patch(i, { sets: v })} min={1} max={10} />
                {timed ? (
                  <Mini label="Secondes" value={e.seconds ?? 30} onChange={(v) => patch(i, { seconds: v })} step={5} min={5} max={600} />
                ) : (
                  <Mini label="Reps" value={e.reps ?? 10} onChange={(v) => patch(i, { reps: v })} min={1} max={100} />
                )}
                <Mini label="Repos (s)" value={e.restSec} onChange={(v) => patch(i, { restSec: v })} step={15} min={0} max={300} />
                {ex?.loaded && <Mini label="Poids (kg)" value={e.weightKg ?? 0} onChange={(v) => patch(i, { weightKg: v || undefined })} step={2.5} min={0} max={400} />}
              </View>
            </View>
          );
        })
      )}

      <Button title="Ajouter des exercices" icon="add" variant="secondary" onPress={() => setPicking(true)} />
      <Button title="Enregistrer la séance" icon="checkmark" big onPress={save} disabled={!exercises.length} />

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choisis tes exercices</Text>
            <Button title={`OK (${exercises.length})`} onPress={() => setPicking(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl * 2 }} keyboardShouldPersistTaps="handled">
            <ExerciseList equipment={data.profile.equipment} onSelect={(ex) => toggle(ex.id)} selected={exercises.map((e) => e.exerciseId)} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

function Mini({ label, value, onChange, step = 1, min = 0, max = 999 }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <View
      style={styles.mini}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: String(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(e.nativeEvent.actionName === 'increment' ? Math.min(max, value + step) : Math.max(min, value - step))}
    >
      <Text style={styles.miniLabel}>{label}</Text>
      <View style={styles.miniRow}>
        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} : moins`} onPress={() => onChange(Math.max(min, value - step))} style={(s: PressState) => [styles.miniBtn, focusRing(s, 16)]}>
          <Ionicons name="remove" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.miniValue}>{value}</Text>
        <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} : plus`} onPress={() => onChange(Math.min(max, value + step))} style={(s: PressState) => [styles.miniBtn, focusRing(s, 16)]}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emptyBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  index: { color: colors.muted, fontFamily: font.black, width: 22, fontVariant: ['tabular-nums'] },
  name: { color: colors.text, fontFamily: font.black, fontSize: 15, flex: 1 },
  params: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mini: { flexGrow: 1, minWidth: '45%', backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.sm, alignItems: 'center', gap: 4 },
  miniLabel: { color: colors.muted, fontSize: 12, fontFamily: font.bold },
  miniBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  miniRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  miniValue: { color: colors.text, fontFamily: font.black, fontSize: 18, minWidth: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.text, fontFamily: font.black, fontSize: 20 },
});
