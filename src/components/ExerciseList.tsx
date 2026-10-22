import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BODY_PART_LABEL, CATEGORY_LABEL, equipmentLabel, Exercise, EXERCISE_LIST, isAvailable, MUSCLE_LABEL, musclesLabel } from '@/data/exercises';
import type { Equipment } from '@/store/types';
import { focusRing, PressState } from '@/lib/motion';
import { colors, font, radius, spacing, type } from '@/theme';

import { ExerciseDemo } from './ExerciseDemo';
import { Tag } from './kit';
import { Chip } from './ui';

const MUSCLES = Object.keys(MUSCLE_LABEL).filter((m) => m !== 'mobilite');
const LEVEL = ['', 'Débutant', 'Intermédiaire', 'Confirmé'];
const LEVEL_COLOR = ['', colors.accentInk, colors.yellow, colors.rest];
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Liste filtrable d'exercices. En mode sélection, un appui ajoute l'exercice ; sinon il déplie le détail. */
export function ExerciseList({ equipment, onSelect, selected }: { equipment: Equipment[]; onSelect?: (e: Exercise) => void; selected?: string[] }) {
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<string | null>(null);
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(
    () =>
      EXERCISE_LIST.filter((e) => e.category !== 'warmup')
        .filter((e) => !mine || isAvailable(e, equipment))
        .filter((e) => !muscle || e.muscles.includes(muscle as Exercise['muscles'][number]))
        .filter((e) => !query.trim() || norm(e.name).includes(norm(query.trim())))
        .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)),
    [equipment, mine, muscle, query],
  );

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher un exercice"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          accessibilityLabel="Rechercher un exercice"
          returnKeyType="search"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
        <Chip label="Mon matériel" active={mine} onPress={() => setMine(!mine)} />
        <Chip label="Tous muscles" active={!muscle} onPress={() => setMuscle(null)} />
        {MUSCLES.map((m) => (
          <Chip key={m} label={MUSCLE_LABEL[m]} active={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
        ))}
      </ScrollView>
      <Text style={styles.count} accessibilityLiveRegion="polite">
        {list.length} exercice{list.length > 1 ? 's' : ''}
      </Text>
      {list.length === 0 && <Text style={styles.meta}>Aucun exercice ne correspond. Retire un filtre ou décoche « Mon matériel ».</Text>}
      {list.map((e) => {
        const isSel = selected?.includes(e.id);
        const expanded = open === e.id;
        return (
          <Pressable
            key={e.id}
            onPress={() => (onSelect ? onSelect(e) : setOpen(expanded ? null : e.id))}
            onLongPress={() => setOpen(expanded ? null : e.id)}
            accessibilityRole="button"
            accessibilityLabel={`${e.name}, ${LEVEL[e.level].toLowerCase()}`}
            accessibilityState={onSelect ? { selected: !!isSel } : { expanded }}
            style={(s: PressState) => [styles.row, isSel && styles.rowSelected, !isSel && s.hovered && { borderColor: colors.borderStrong }, s.pressed && { opacity: 0.8 }, focusRing(s, radius.md)]}
          >
            <View style={styles.rowTop}>
              <View style={[styles.level, { backgroundColor: LEVEL_COLOR[e.level] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{e.name}</Text>
                <Text style={styles.meta}>
                  {musclesLabel(e)}, {equipmentLabel(e).toLowerCase()}
                </Text>
              </View>
              {onSelect ? (
                <Ionicons name={isSel ? 'checkmark-circle' : 'add-circle-outline'} size={26} color={isSel ? colors.accentInk : colors.muted} />
              ) : (
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
              )}
            </View>
            {expanded && (
              <View style={{ gap: 6, marginTop: spacing.sm }}>
                <ExerciseDemo exerciseId={e.id} size={180} />
                <View style={styles.tags}>
                  <Tag label={CATEGORY_LABEL[e.category]} color={colors.text} />
                  <Tag label={LEVEL[e.level]} color={LEVEL_COLOR[e.level]} />
                  <Tag label={e.mode === 'time' ? 'Au temps' : 'En répétitions'} color={colors.text} />
                </View>
                {e.cues.map((c, i) => (
                  <View key={i} style={styles.cue}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={colors.accentInk} />
                    <Text style={styles.cueText}>{c}</Text>
                  </View>
                ))}
                {e.easier && (
                  <View style={styles.cue}>
                    <Ionicons name="leaf-outline" size={16} color={colors.rest} />
                    <Text style={[styles.cueText, { color: colors.muted }]}>Plus facile : {e.easier}</Text>
                  </View>
                )}
                {e.stresses.length > 0 && <Text style={styles.meta}>Sollicite : {e.stresses.map((s) => BODY_PART_LABEL[s].toLowerCase()).join(', ')}</Text>}
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderStrong },
  searchInput: { fontFamily: font.regular, flex: 1, color: colors.text, paddingVertical: 10, fontSize: 16 },
  count: { color: colors.muted, ...type.small },
  row: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  rowSelected: { borderColor: colors.dark, borderWidth: 2, padding: spacing.md - 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  level: { width: 6, height: 34, borderRadius: 3 },
  name: { color: colors.text, fontFamily: font.black, fontSize: 15 },
  meta: { color: colors.muted, ...type.small, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cue: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  cueText: { fontFamily: font.regular, color: colors.text, fontSize: 14, flex: 1 },
});
