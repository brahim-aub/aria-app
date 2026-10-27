import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EditorialCard, workoutImage } from '@/components/brand';
import { askCoach, useDayActions } from '@/components/DayActions';
import { ExerciseRow, SectionHeader, Segmented, Tag } from '@/components/kit';
import { Button, Card, Chip, H1, IconButton, Muted, Screen } from '@/components/ui';
import { BODY_PART_LABEL } from '@/data/exercises';
import { DAY_SHORT, GOAL_LABEL, LEVEL_LABEL } from '@/data/generator';
import { confirmAction } from '@/lib/confirm';
import { addDays, dateKey, formatKey, relativeDay, weekdayIndex } from '@/lib/date';
import { focusRing, PressState, pressFeedback } from '@/lib/motion';
import { getRange, nextSession, ScheduledDay } from '@/lib/schedule';
import { estimateMinutes } from '@/lib/workout';
import { useApp } from '@/store/AppStore';
import { colors, radius, spacing, font } from '@/theme';

const STATUS: Record<ScheduledDay['status'], { label: string; color: string }> = {
  planned: { label: 'Prévue', color: colors.text },
  done: { label: 'Faite', color: colors.accentInk },
  skipped: { label: 'Passée', color: colors.muted },
  missed: { label: 'Manquée', color: colors.rest },
  rest: { label: 'Repos', color: colors.muted },
};

export default function Programme() {
  const { data, regeneratePlan, removeLimitation } = useApp();
  const dayActions = useDayActions();
  const [showRest, setShowRest] = useState(false);
  const [week, setWeek] = useState<'0' | '1' | '2'>('0');
  const [openTemplate, setOpenTemplate] = useState<string | null>(null);
  const today = dateKey();
  const monday = addDays(today, -weekdayIndex(today));
  const days = getRange(data, monday, 21);
  const p = data.profile;
  const next = nextSession(data, today, 21);
  const limitations = data.limitations.filter((l) => l.endDate >= today);

  const weeks = [0, 1, 2].map((w) => days.slice(w * 7, w * 7 + 7));

  return (
    <Screen>
      {dayActions.element}
      <H1 style={{ marginTop: spacing.sm }}>Programme</H1>
      {next?.session && (
        <EditorialCard kicker={relativeDay(next.date) + ' · TA PROCHAINE SÉANCE'} image={workoutImage(next.session.title)} title={next.session.title} subtitle={estimateMinutes(next.session) + ' min · ' + next.session.exercises.length + ' exercices'} action="Voir les exercices" onPress={() => router.push(`/seance/d-${next.date}`)} />
      )}
      <Card>
        <View style={styles.tags}>
          <Tag label={GOAL_LABEL[p.goal]} color={colors.text} icon="flag" />
          <Tag label={LEVEL_LABEL[p.level]} color={colors.text} icon="stats-chart" />
          <Tag label={`${p.sessionsPerWeek} × ${p.sessionMinutes} min`} color={colors.text} icon="time" />
        </View>
        <Muted>Jours : {p.trainingDays.map((d) => DAY_SHORT[d]).join(', ')}. Appuie sur une séance pour voir ses exercices. Le bouton ⋯ permet de la décaler, la changer ou l’adapter.</Muted>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Modifier" icon="options" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/reglages')} />
          <Button title="Coach" icon="sparkles" style={{ flex: 1 }} onPress={() => askCoach('Je voudrais modifier mon programme : ')} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Séances seulement" active={!showRest} onPress={() => setShowRest(false)} color={colors.cyan} />
        <Chip label="Tous les jours" active={showRest} onPress={() => setShowRest(true)} color={colors.cyan} />
      </View>

      <Segmented label="Semaine du programme" value={week} onChange={setWeek} options={[{ value: '0', label: 'Cette semaine' }, { value: '1', label: 'Prochaine' }, { value: '2', label: 'Dans 2 sem.' }]} />
      {weeks.map((w, i) => i === Number(week) && (
        <View key={i} style={{ gap: spacing.sm }}>
          <SectionHeader title={i === 0 ? 'Cette semaine' : i === 1 ? 'Semaine prochaine' : `Semaine du ${formatKey(w[0].date, { day: 'numeric', month: 'short' })}`} />
          {w
            .filter((d) => showRest || d.session || d.log)
            .map((d) => (
              <DayRow key={d.date} day={d} today={today} onPress={d.status === 'done' ? undefined : d.session ? () => router.push({ pathname: '/seance/[id]', params: { id: 'd-' + d.date } }) : () => dayActions.open(d)} onOptions={d.status === 'done' ? undefined : () => dayActions.open(d)} />
            ))}
          {!showRest && !w.some((d) => d.session || d.log) && <Muted>Aucune séance.</Muted>}
        </View>
      ))}

      {limitations.length > 0 && (
        <>
          <SectionHeader title="Zones ménagées" />
          {limitations.map((l) => (
            <Card key={l.id} style={styles.limit}>
              <Ionicons name="bandage-outline" size={20} color={colors.rest} />
              <View style={{ flex: 1 }}>
                <Text style={styles.dayTitle}>{BODY_PART_LABEL[l.bodyPart]}</Text>
                <Muted>
                  Jusqu’au {formatKey(l.endDate, { day: 'numeric', month: 'long' })} · {l.note}
                </Muted>
              </View>
              <IconButton
                icon="close"
                plain
                label={`Retirer la zone ménagée : ${BODY_PART_LABEL[l.bodyPart]}`}
                color={colors.muted}
                onPress={async () => {
                  if (await confirmAction('Plus de douleur ?', `Les exercices qui sollicitent cette zone (${BODY_PART_LABEL[l.bodyPart].toLowerCase()}) reviendront dans tes séances.`, 'C’est guéri')) removeLimitation(l.id);
                }}
              />
            </Card>
          ))}
        </>
      )}

      <SectionHeader title="Ta rotation de séances" />
      <Muted>Ces séances s’enchaînent dans l’ordre sur tes jours d’entraînement.</Muted>
      {data.plan.templates.map((t, i) => (
        <Card key={t.id}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.title + ', voir les exercices'} accessibilityState={{ expanded: openTemplate === t.id }} onPress={() => setOpenTemplate(openTemplate === t.id ? null : t.id)} style={[styles.rowBetween, { minHeight: 48 }]}>
            <View style={styles.rotation}>
              <View style={styles.letter}>
                <Text style={styles.letterText}>{String.fromCharCode(65 + i)}</Text>
              </View>
              <Text style={[styles.dayTitle, { flex: 1 }]}>{t.title}</Text>
            </View>
            <Tag label={`${estimateMinutes(t)} min`} color={colors.text} />
            <Ionicons name={openTemplate === t.id ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
          </Pressable>
          {openTemplate === t.id && <>
          {t.focus ? <Muted>{t.focus}</Muted> : null}
          {t.exercises.map((e, k) => (
            <ExerciseRow key={k} e={e} index={k} />
          ))}
          </>}
        </Card>
      ))}
      <Button
        title="Reconstruire le programme"
        icon="refresh"
        variant="secondary"
        onPress={async () => {
          if (await confirmAction('Reconstruire le programme ?', 'Les séances à venir sont recréées à partir de ton profil. Les modifications futures sont effacées.', 'Reconstruire')) regeneratePlan();
        }}
      />
    </Screen>
  );
}

function DayRow({ day, today, onPress, onOptions }: { day: ScheduledDay; today: string; onPress?: () => void; onOptions?: () => void }) {
  const st = STATUS[day.status];
  const isToday = day.date === today;
  return (
    <View style={[styles.day, isToday && styles.dayToday]}>
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${relativeDay(day.date)}, ${day.log?.title ?? day.session?.title ?? 'repos'}, ${st.label.toLowerCase()}`}
      style={(s: PressState) => [styles.dayContent, onPress && s.hovered && { borderColor: colors.borderStrong }, onPress && pressFeedback(s, 0.99), focusRing(s, radius.md)]}
    >
      <View style={[styles.dayDate, { backgroundColor: st.color + '22' }]}>
        <Text style={[styles.dayWeek, { color: st.color }]}>{formatKey(day.date, { weekday: 'short' }).replace('.', '')}</Text>
        <Text style={[styles.dayNum, { color: st.color }]}>{Number(day.date.slice(8))}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.dayTitle} numberOfLines={1}>
          {day.log?.title ?? day.session?.title ?? 'Repos'}
        </Text>
        <Text style={styles.dayMeta} numberOfLines={1}>
          {isToday ? "Aujourd'hui · " : ''}
          {st.label}
          {day.session && day.status !== 'done' ? ` · ${estimateMinutes(day.session)} min` : ''}
          {day.log ? ` · ${day.log.durationMin} min` : ''}
          {day.movedTo ? ` · décalée à ${relativeDay(day.movedTo).toLowerCase()}` : ''}
        </Text>
        {(day.modified || day.adaptations.length > 0) && day.status !== 'done' && (
          <Text style={styles.dayMod} numberOfLines={1}>
            {day.modified ? (day.reason ?? 'Modifiée') : `${day.adaptations.length} exercice(s) adapté(s)`}
          </Text>
        )}
      </View>
      {day.status === 'done' ? <Ionicons name="checkmark-circle" size={22} color={colors.accentInk} /> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
      {onOptions && <IconButton icon="ellipsis-horizontal" plain label={'Options de la séance : ' + relativeDay(day.date).toLowerCase()} onPress={onOptions} />}
    </View>
  );
}

const styles = StyleSheet.create({
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.sm + 2 },
  dayContent: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.md },
  dayDate: { width: 48, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayWeek: { fontSize: 12, fontFamily: font.black },
  dayNum: { fontSize: 19, fontFamily: font.black },
  dayTitle: { color: colors.text, fontFamily: font.black, fontSize: 15 },
  dayMeta: { fontFamily: font.regular, color: colors.muted, fontSize: 13 },
  dayMod: { color: colors.violet, fontSize: 12, fontFamily: font.bold },
  dayToday: { borderColor: colors.dark, borderWidth: 2, padding: spacing.sm + 1 },
  rotation: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  letter: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: colors.accent, fontFamily: font.black, fontSize: 14 },
  limit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
