import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Chip, Row, Screen, Title } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { CATEGORY_LABELS, EXERCISES, LEVEL_LABELS } from '@/data/exercises';
import type { Category } from '@/lib/types';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

export default function Exercises() {
  const [category, setCategory] = useState<Category | null>(null);
  const list = category ? EXERCISES.filter((e) => e.category === category) : EXERCISES;

  return (
    <Screen>
      <Title>Exercices</Title>
      <Body muted>Chaque exercice a une version plus douce si besoin.</Body>
      <Row>
        <Chip label="Tous" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((item) => (
          <Chip
            key={item}
            label={CATEGORY_LABELS[item]}
            selected={category === item}
            onPress={() => setCategory(item)}
          />
        ))}
      </Row>
      {list.map((exercise) => (
        <Link key={exercise.id} href={{ pathname: '/exercise/[id]', params: { id: exercise.id } }} asChild>
          <Pressable style={styles.item}>
            <View style={styles.flex}>
              <Text style={styles.name}>{exercise.name}</Text>
              <Text style={styles.meta}>
                {CATEGORY_LABELS[exercise.category]} · {LEVEL_LABELS[exercise.level]}
                {exercise.equipment.length === 0 ? ' · sans matériel' : ''}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Link>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', color: Colors.text },
  meta: { fontSize: 14, color: Colors.textSecondary },
  chevron: { fontSize: 28, color: Colors.textSecondary },
});
