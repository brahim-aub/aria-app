import { Link, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Body, Card, Screen, Title } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { CATEGORY_LABELS, getExercise, LEVEL_LABELS, ZONE_LABELS } from '@/data/exercises';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exercise = getExercise(id);

  if (!exercise) {
    return (
      <Screen edges={[]}>
        <Body>Exercice introuvable.</Body>
      </Screen>
    );
  }

  const easier = exercise.easierId ? getExercise(exercise.easierId) : undefined;

  return (
    <Screen edges={[]}>
      <Title>{exercise.name}</Title>
      <Body muted>
        {CATEGORY_LABELS[exercise.category]} · {LEVEL_LABELS[exercise.level]} ·{' '}
        {exercise.mode === 'time' ? `${exercise.amount} secondes` : `${exercise.amount} répétitions`}
      </Body>

      {/* Emplacement de l'illustration ou de l'animation de l'exercice. */}
      <Card style={styles.illustration}>
        <Text style={styles.illustrationText}>Illustration à venir</Text>
      </Card>

      <Card>
        <Text style={styles.section}>Comment faire</Text>
        {exercise.instructions.map((line, index) => (
          <Body key={index}>
            {index + 1}. {line}
          </Body>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>Pourquoi ça t&apos;aide</Text>
        <Body>{exercise.why}</Body>
      </Card>

      {exercise.stresses.length > 0 && (
        <Card>
          <Text style={styles.section}>Articulations sollicitées</Text>
          <Body>{exercise.stresses.map((zone) => ZONE_LABELS[zone]).join(', ')}</Body>
          <Body muted>Si l&apos;une d&apos;elles te fait mal, prends la version plus douce ou passe l&apos;exercice.</Body>
          {easier && (
            <Link href={{ pathname: '/exercise/[id]', params: { id: easier.id } }} style={styles.link}>
              Version plus douce : {easier.name} ›
            </Link>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  illustration: { height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surface },
  illustrationText: { color: Colors.textSecondary, fontSize: 15 },
  section: { fontSize: 18, fontWeight: '600', color: Colors.text },
  link: { fontSize: 16, fontWeight: '700', color: Colors.text, marginTop: 4, textDecorationLine: 'underline' },
});
