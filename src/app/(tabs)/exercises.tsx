import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, CategoryTile, Chip, Screen, Title } from '@/components/ui';
import { CategoryIcons, Colors, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
import { CATEGORY_LABELS, EXERCISES, LEVEL_LABELS } from '@/data/exercises';
import type { Category } from '@/lib/types';

const CATEGORIES = Object.keys(CATEGORY_LABELS) as Category[];

/** Compare sans tenir compte des accents ni des majuscules. */
function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export default function Exercises() {
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState('');
  const search = normalize(query.trim());
  const list = EXERCISES.filter(
    (e) => (!category || e.category === category) && (!search || normalize(e.name).includes(search)),
  );

  return (
    <Screen>
      <Title style={styles.title}>Exercices</Title>
      <Body muted>Chaque exercice a une version plus douce si besoin.</Body>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={Colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un exercice"
          placeholderTextColor={Colors.textSecondary}
        />
        {query !== '' && (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Tous" selected={!category} onPress={() => setCategory(null)} />
        {CATEGORIES.map((item) => (
          <Chip
            key={item}
            label={CATEGORY_LABELS[item]}
            icon={CategoryIcons[item]}
            selected={category === item}
            onPress={() => setCategory(category === item ? null : item)}
          />
        ))}
      </ScrollView>

      <Text style={styles.count}>
        {list.length} exercice{list.length > 1 ? 's' : ''}
      </Text>
      {list.map((exercise) => (
        <Link key={exercise.id} href={{ pathname: '/exercise/[id]', params: { id: exercise.id } }} asChild>
          <Pressable style={styles.item}>
            <CategoryTile category={exercise.category} size={46} />
            <View style={styles.flex}>
              <Text style={styles.name}>{exercise.name}</Text>
              <Text style={styles.meta}>
                {CATEGORY_LABELS[exercise.category]} · {LEVEL_LABELS[exercise.level]}
                {exercise.equipment.length === 0 ? ' · sans matériel' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>
        </Link>
      ))}
      {list.length === 0 && <Body muted>Aucun exercice ne correspond à ta recherche.</Body>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: Spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    ...Shadow,
  },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 16, fontFamily: Fonts.medium, color: Colors.text },
  chips: { gap: Spacing.sm, paddingRight: Spacing.md },
  count: { fontSize: 13, fontFamily: Fonts.semibold, color: Colors.textSecondary },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.sm + 4,
    ...Shadow,
  },
  flex: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  meta: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
});
