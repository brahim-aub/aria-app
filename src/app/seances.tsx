import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useActionSheet } from '@/components/ActionSheet';
import { EmptyState, SectionHeader, Segmented, Tag } from '@/components/kit';
import { Button, Chip, IconButton, Muted, Screen } from '@/components/ui';
import { focusRing, PressState, pressFeedback } from '@/lib/motion';
import { isAvailable, EXERCISES } from '@/data/exercises';
import { LEVEL_LABEL } from '@/data/generator';
import { EQUIPMENT_TAG_LABEL, PRESETS } from '@/data/presets';
import { confirmAction } from '@/lib/confirm';
import { relativeDay } from '@/lib/date';
import { estimateMinutes, newId, sessionSummary } from '@/lib/workout';
import { useApp } from '@/store/AppStore';
import type { WorkoutSession } from '@/store/types';
import { colors, font, radius, spacing, type } from '@/theme';

type EquipFilter = 'all' | 'none' | 'small' | 'gym' | 'mine';

export default function Seances() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { data, replaceDay, deleteCustomSession } = useApp();
  const sheet = useActionSheet();
  const [equip, setEquip] = useState<EquipFilter>('mine');
  const [level, setLevel] = useState<string>('all');
  const [library, setLibrary] = useState<'ready' | 'custom'>('ready');

  const canDo = (s: WorkoutSession) => s.exercises.every((e) => EXERCISES[e.exerciseId] && isAvailable(EXERCISES[e.exerciseId], data.profile.equipment));
  const presets = PRESETS.filter((p) => (equip === 'all' ? true : equip === 'mine' ? canDo(p) : p.equipmentTag === equip)).filter((p) => level === 'all' || p.level === level);

  const choose = (s: WorkoutSession, idPrefix: 'p' | 'c') => {
    if (date) {
      replaceDay(date, { ...s, id: newId() }, `Séance choisie : ${s.title}`);
      router.back();
    } else router.push(`/seance/${idPrefix}-${s.id}`);
  };

  const customMenu = (s: WorkoutSession) =>
    sheet.open(s.title, [
      { label: 'Voir les exercices', icon: 'play', color: colors.accentInk, onPress: () => router.push(`/seance/c-${s.id}`) },
      { label: 'Modifier', icon: 'create', onPress: () => router.push({ pathname: '/creer-seance', params: { id: s.id } }) },
      {
        label: 'Supprimer',
        icon: 'trash',
        destructive: true,
        onPress: () =>
          void confirmAction('Supprimer cette séance ?', s.title, 'Supprimer', true).then((ok) => {
            if (ok) deleteCustomSession(s.id);
          }),
      },
    ]);

  return (
    <Screen top={false}>
      {sheet.element}
      {date && (
        <View style={styles.banner}>
          <Ionicons name="calendar-outline" size={18} color={colors.text} />
          <Text style={styles.bannerText}>Choisis la séance pour {relativeDay(date).toLowerCase()}</Text>
        </View>
      )}

      <Segmented label="Bibliothèque de séances" value={library} onChange={setLibrary} options={[{ value: 'ready', label: 'Séances prêtes' }, { value: 'custom', label: 'Mes séances' }]} />
      <Muted>{date ? 'La séance choisie remplacera celle de ce jour.' : 'Ouvre une séance pour découvrir ses exercices avant de la commencer.'}</Muted>
      {library === 'custom' ? <>
      <SectionHeader title="Mes séances" action="Créer" onAction={() => router.push({ pathname: '/creer-seance', params: date ? { date } : {} })} />
      {data.customSessions.length === 0 ? (
        <View style={styles.emptyBox}>
          <EmptyState icon="construct-outline" title="Crée ta propre séance" text="Choisis tes exercices dans la bibliothèque, règle séries et repos, et c’est parti.">
            <Button title="Créer une séance" icon="add" onPress={() => router.push({ pathname: '/creer-seance', params: date ? { date } : {} })} />
          </EmptyState>
        </View>
      ) : (
        data.customSessions.map((s) => <SessionCard key={s.id} s={s} onPress={() => choose(s, 'c')} onMore={() => customMenu(s)} badge="Perso" />)
      )}

      </> : <>
      <SectionHeader title="Séances prêtes" />
      <Text style={styles.filterLabel}>Matériel</Text>
      <View style={styles.chips}>
        <Chip label="Mon matériel" active={equip === 'mine'} onPress={() => setEquip('mine')} />
        <Chip label="Toutes" active={equip === 'all'} onPress={() => setEquip('all')} />
        {(Object.keys(EQUIPMENT_TAG_LABEL) as (keyof typeof EQUIPMENT_TAG_LABEL)[]).map((k) => (
          <Chip key={k} label={EQUIPMENT_TAG_LABEL[k]} active={equip === k} onPress={() => setEquip(k)} />
        ))}
      </View>
      <Text style={styles.filterLabel}>Niveau</Text>
      <View style={styles.chips}>
        <Chip label="Tous niveaux" active={level === 'all'} onPress={() => setLevel('all')} />
        {Object.entries(LEVEL_LABEL).map(([k, v]) => (
          <Chip key={k} label={v} active={level === k} onPress={() => setLevel(k)} />
        ))}
      </View>
      <Muted>{presets.length} séance(s) disponible(s) · {equip === 'mine' ? 'Avec ton matériel' : 'Selon tes filtres'}</Muted>
      {presets.length === 0 && <EmptyState icon="search-outline" title="Aucune séance trouvée" text="Élargis les filtres pour découvrir les autres séances."><Button title="Afficher toutes les séances" variant="secondary" onPress={() => { setEquip('all'); setLevel('all'); }} /></EmptyState>}
      {presets.map((p) => (
        <SessionCard key={p.id} s={p} onPress={() => choose(p, 'p')} badge={LEVEL_LABEL[p.level]} extra={EQUIPMENT_TAG_LABEL[p.equipmentTag]} />
      ))}
      </>}
    </Screen>
  );
}

function SessionCard({ s, onPress, onMore, badge, extra }: { s: WorkoutSession; onPress: () => void; onMore?: () => void; badge?: string; extra?: string }) {
  return (
    <View style={styles.cardWrap}>
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      accessibilityRole="button"
      accessibilityLabel={`${s.title}, ${estimateMinutes(s)} minutes`}
      style={(st: PressState) => [styles.card, st.hovered && { borderColor: colors.borderStrong }, pressFeedback(st, 0.99), focusRing(st, radius.md)]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <View style={[styles.rowBetween, onMore && { paddingRight: 40 }]}>
          <Text style={styles.title} numberOfLines={2}>
            {s.title}
          </Text>
          <View style={styles.duration}><Ionicons name="time-outline" size={15} color={colors.accent} /><Text style={styles.min}>{estimateMinutes(s)} min</Text></View>
        </View>
        {s.focus ? <Text style={styles.focus}>{s.focus}</Text> : null}
        <Text style={styles.summary} numberOfLines={2}>
          {s.exercises.length} exercices · {sessionSummary(s)}
        </Text>
        <View style={styles.tags}>
          {badge && <Tag label={badge} color={colors.text} />}
          {extra && <Tag label={extra} color={colors.muted} />}
          {s.format === 'circuit' && <Tag label="Circuit" color={colors.rest} />}
        </View>
      </View>
    </Pressable>
    {onMore && (
      <View style={styles.more}>
        <IconButton icon="ellipsis-horizontal" plain size={20} label={`Options de ${s.title}`} onPress={onMore} />
      </View>
    )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accentDim, padding: spacing.md, borderRadius: radius.md },
  filterLabel: { color: colors.text, fontFamily: font.black, fontSize: 14, marginBottom: -spacing.xs },
  bannerText: { color: colors.text, fontFamily: font.bold, flex: 1 },
  emptyBox: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cardWrap: { position: 'relative' },
  more: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  card: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, overflow: 'hidden' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { color: colors.text, fontFamily: font.black, fontSize: 16, flex: 1 },
  duration: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accentDim, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 8, flexShrink: 0 },
  min: { color: colors.accent, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  focus: { color: colors.text, ...type.small },
  summary: { color: colors.muted, ...type.small },
  tags: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 },
});
