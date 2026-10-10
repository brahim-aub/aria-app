import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, Row, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CATEGORY_LABELS, getExercise } from '@/data/exercises';
import { candidatesFor, estimateSeconds, makeStep, restFor } from '@/lib/program';
import type { Category, SessionStep } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];
const MAX_SETS = 6;

export default function EditSession() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.todaySession);
  const intensity = useAppStore((state) => state.intensity);
  const setTodaySession = useAppStore((state) => state.setTodaySession);

  const [steps, setSteps] = useState<SessionStep[]>(session?.steps ?? []);
  const [addCategory, setAddCategory] = useState<Category | null>(null);

  if (!profile || !session) return null;

  const avoided = session.avoidedZones;
  const minutes = Math.max(1, Math.round(estimateSeconds(steps) / 60));

  const update = (index: number, patch: Partial<SessionStep>) =>
    setSteps(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));

  // Remplace par l'exercice suivant de la même catégorie, compatible avec le profil.
  const replace = (index: number) => {
    const current = getExercise(steps[index].exerciseId);
    if (!current) return;
    const used = new Set(steps.map((step) => step.exerciseId));
    const options = candidatesFor(current.category, profile, avoided).filter(
      (exercise) => exercise.id === current.id || !used.has(exercise.id),
    );
    if (options.length < 2) return;
    const position = options.findIndex((exercise) => exercise.id === current.id);
    const next = options[(position + 1) % options.length];
    const step = steps[index];
    setSteps(steps.map((s, i) => (i === index ? makeStep(next, step.sets, step.restSeconds, intensity) : s)));
  };

  const add = (exerciseId: string) => {
    const exercise = getExercise(exerciseId);
    if (!exercise) return;
    // On insère avant le retour au calme (dernier exercice) quand il existe.
    const insertAt = steps.length > 1 ? steps.length - 1 : steps.length;
    const step = makeStep(exercise, 2, restFor(profile), intensity);
    setSteps([...steps.slice(0, insertAt), step, ...steps.slice(insertAt)]);
    setAddCategory(null);
  };

  const save = () => {
    setTodaySession({ ...session, id: `${Date.now()}`, title: 'Ma séance', steps, minutes });
    router.back();
  };

  const used = new Set(steps.map((step) => step.exerciseId));
  const addOptions = addCategory
    ? candidatesFor(addCategory, profile, avoided).filter((exercise) => !used.has(exercise.id))
    : [];

  return (
    <Screen edges={['bottom']}>
      <Body muted>Environ {minutes} minutes. Les exercices proposés respectent ton niveau et tes zones à ménager.</Body>

      {steps.map((step, index) => {
        const exercise = getExercise(step.exerciseId);
        if (!exercise) return null;
        const unit = exercise.mode === 'time' ? 's' : 'rép.';
        return (
          <Card key={`${step.exerciseId}-${index}`}>
            <Text style={styles.name}>{exercise.name}</Text>
            <Text style={styles.meta}>
              {step.amount} {unit} par série
            </Text>
            <View style={styles.setsRow}>
              <Text style={styles.setsLabel}>Séries</Text>
              <Stepper
                label="-"
                disabled={step.sets <= 1}
                onPress={() => update(index, { sets: step.sets - 1 })}
              />
              <Text style={styles.sets}>{step.sets}</Text>
              <Stepper
                label="+"
                disabled={step.sets >= MAX_SETS}
                onPress={() => update(index, { sets: step.sets + 1 })}
              />
            </View>
            <Row>
              <Chip label="Remplacer" onPress={() => replace(index)} />
              {steps.length > 1 && (
                <Chip label="Retirer" onPress={() => setSteps(steps.filter((_, i) => i !== index))} />
              )}
            </Row>
          </Card>
        );
      })}

      <Card>
        <Text style={styles.name}>Ajouter un exercice</Text>
        <Row>
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              label={CATEGORY_LABELS[category]}
              selected={addCategory === category}
              onPress={() => setAddCategory(addCategory === category ? null : category)}
            />
          ))}
        </Row>
        {addCategory && addOptions.length === 0 && (
          <Body muted>Aucun autre exercice adapté dans cette catégorie.</Body>
        )}
        {addOptions.map((exercise) => (
          <Pressable key={exercise.id} style={styles.option} onPress={() => add(exercise.id)}>
            <Text style={styles.optionText}>{exercise.name}</Text>
            <Text style={styles.plus}>+</Text>
          </Pressable>
        ))}
      </Card>

      <Button label="Enregistrer ma séance" disabled={steps.length === 0} onPress={save} />
    </Screen>
  );
}

function Stepper({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'Ajouter une série' : 'Retirer une série'}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stepper, disabled && styles.disabled]}>
      <Text style={styles.stepperText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 14, color: Colors.textSecondary },
  setsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  setsLabel: { flex: 1, fontSize: 16, color: Colors.text },
  sets: { minWidth: 24, textAlign: 'center', fontSize: 18, fontWeight: '600', color: Colors.text },
  stepper: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
  },
  stepperText: { fontSize: 20, color: Colors.text },
  disabled: { opacity: 0.35 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  optionText: { fontSize: 16, color: Colors.text },
  plus: { fontSize: 22, color: Colors.textSecondary },
});
