import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Body, Card, CategoryTile, Heading, IconTile, Row, Screen, Title } from '@/components/ui';
import { CategoryColors, Colors, Fonts, Radius, Spacing } from '@/constants/theme';
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
  const { tint } = CategoryColors[exercise.category];

  return (
    <Screen edges={['bottom']}>
      {/* Emplacement de l'illustration ou de l'animation de l'exercice. */}
      <View style={[styles.illustration, { backgroundColor: tint }]}>
        <CategoryTile category={exercise.category} size={96} />
        <Text style={styles.illustrationText}>Illustration à venir</Text>
      </View>

      <Title>{exercise.name}</Title>
      <Row>
        <Badge label={CATEGORY_LABELS[exercise.category]} />
        <Badge icon="trending-up" label={LEVEL_LABELS[exercise.level]} />
        <Badge
          tone="accent"
          icon={exercise.mode === 'time' ? 'time-outline' : 'repeat'}
          label={exercise.mode === 'time' ? `${exercise.amount} secondes` : `${exercise.amount} répétitions`}
        />
      </Row>

      <Card>
        <Heading>Comment faire</Heading>
        {exercise.instructions.map((line, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <Body style={styles.flex}>{line}</Body>
          </View>
        ))}
      </Card>

      <Card>
        <View style={styles.titleRow}>
          <IconTile icon="bulb" tint={Colors.accentSoft} color={Colors.accentDeep} size={36} />
          <Heading>Pourquoi ça t&apos;aide</Heading>
        </View>
        <Body>{exercise.why}</Body>
      </Card>

      {exercise.stresses.length > 0 && (
        <Card>
          <View style={styles.titleRow}>
            <IconTile icon="alert-circle" tint="#FFEDE2" color="#D9561C" size={36} />
            <Heading>Articulations sollicitées</Heading>
          </View>
          <Body>{exercise.stresses.map((zone) => ZONE_LABELS[zone]).join(', ')}</Body>
          <Body muted>
            Si l&apos;une d&apos;elles te fait mal, prends la version plus douce ou passe l&apos;exercice.
          </Body>
          {easier && (
            <Link href={{ pathname: '/exercise/[id]', params: { id: easier.id } }} asChild>
              <Pressable style={styles.easier}>
                <CategoryTile category={easier.category} size={38} />
                <View style={styles.flex}>
                  <Text style={styles.easierEyebrow}>Version plus douce</Text>
                  <Text style={styles.easierName}>{easier.name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </Pressable>
            </Link>
          )}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  illustration: {
    height: 200,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  illustrationText: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  stepRow: { flexDirection: 'row', gap: Spacing.sm + 4, alignItems: 'flex-start' },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { fontSize: 13, fontFamily: Fonts.extrabold, color: Colors.accent },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + 4 },
  easier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    padding: Spacing.sm + 4,
    marginTop: Spacing.xs,
  },
  easierEyebrow: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  easierName: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
});
