import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { askCoach, useDayActions } from '@/components/DayActions';
import { Notice, Panel, ProgressBar, SectionHeader } from '@/components/kit';
import { Button, H2, IconButton, IconName, Muted, Screen } from '@/components/ui';
import { levelFromPoints, totalPoints } from '@/data/achievements';
import { BODY_PART_LABEL } from '@/data/exercises';
import { DAY_SHORT } from '@/data/generator';
import { addDays, dateKey, formatKey, greeting, parseKey, relativeDay } from '@/lib/date';
import { focusRing, PressState, pressFeedback } from '@/lib/motion';
import { getDay, nextSession, ScheduledDay, weekDays } from '@/lib/schedule';
import { sessionsThisWeek, weekStreak } from '@/lib/stats';
import { estimateKcal, estimateMinutes, sessionSummary } from '@/lib/workout';
import { useApp } from '@/store/AppStore';
import { useSessionDraft } from '@/store/SessionDraftStore';
import { colors, font, radius, spacing, type } from '@/theme';

const QUICK_PROMPTS: { label: string; icon: IconName; prompt: string }[] = [
  { label: 'J’ai que 15 min', icon: 'timer-outline', prompt: "Aujourd'hui je n'ai que 15 minutes, adapte-moi la séance du jour." },
  { label: 'Pas de matériel', icon: 'home-outline', prompt: "Aujourd'hui je n'ai pas accès à mon matériel / ma salle. Fais-moi une séance sans matériel qui travaille les mêmes muscles." },
  { label: 'Décale à demain', icon: 'arrow-redo-outline', prompt: "Je n'ai pas le temps aujourd'hui, décale ma séance à demain." },
  { label: 'Elle me plaît pas', icon: 'thumbs-down-outline', prompt: "La séance du jour ne me plaît pas, propose-moi autre chose." },
  { label: 'J’ai mal quelque part', icon: 'bandage-outline', prompt: "J'ai une douleur : " },
  { label: 'Plus intense', icon: 'flame-outline', prompt: 'Je me sens en forme, rends ma séance du jour un peu plus intense.' },
];

const STATUS_LABEL: Record<ScheduledDay['status'], string> = {
  planned: 'séance prévue',
  done: 'séance faite',
  skipped: 'séance passée',
  missed: 'séance manquée',
  rest: 'repos',
};

export default function Home() {
  const { data } = useApp();
  const { draft } = useSessionDraft();
  const dayActions = useDayActions();
  const today = dateKey();
  const day = getDay(data, today);
  const week = weekDays(data);
  const upcoming = nextSession(data, addDays(today, 1));
  const next = day.status === 'planned' ? day : upcoming;
  const goal = data.profile.sessionsPerWeek;
  const thisWeek = sessionsThisWeek(data.logs);
  const streak = weekStreak(data.logs, goal);
  const points = totalPoints(data.achievements, data.logs.length);
  const lvl = levelFromPoints(points);
  const limitations = data.limitations.filter((l) => l.endDate >= today);
  const unlocked = Object.keys(data.achievements).length;

  return (
    <Screen>
      {dayActions.element}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Muted>{greeting()}</Muted>
          <Text style={styles.name} role="heading" aria-level={1} numberOfLines={1}>
            {data.profile.name || 'Prêt à bouger ?'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/trophees')}
          accessibilityRole="button"
          accessibilityLabel={`Niveau ${lvl.level}, ${points} points. Voir les trophées`}
          style={(s: PressState) => [styles.level, pressFeedback(s, 0.96), focusRing(s, radius.pill)]}
        >
          <Ionicons name="shield-half" size={15} color={colors.text} />
          <Text style={styles.levelText}>Niv. {lvl.level}</Text>
        </Pressable>
        <IconButton icon="settings-outline" label="Réglages" onPress={() => router.push('/reglages')} />
      </View>


      {draft && (
        <Panel tone="surface">
          <H2>Séance à reprendre</H2>
          <Muted>{draft.resolved.session.title} · progression enregistrée sur cet appareil</Muted>
          <Button title="Reprendre la séance" icon="play" onPress={() => router.push(`/seance/${draft.routeId}`)} />
        </Panel>
      )}

      {/* Semaine */}
      <View style={styles.week}>
        {week.map((d) => {
          const isToday = d.date === today;
          const date = parseKey(d.date);
          const actionable = !!d.session || d.status === 'rest';
          return (
            <Pressable
              key={d.date}
              disabled={!actionable}
              accessibilityRole="button"
              accessibilityLabel={`${relativeDay(d.date)}, ${STATUS_LABEL[d.status]}`}
              style={(s: PressState) => [styles.weekDay, isToday && styles.weekToday, pressFeedback(s, 0.95), focusRing(s, radius.md)]}
              onPress={() => dayActions.open(d)}
            >
              <Text style={[styles.weekLabel, isToday && { color: colors.onDarkMuted }]}>{DAY_SHORT[(date.getDay() + 6) % 7]}</Text>
              <Text style={[styles.weekNum, isToday && { color: colors.onDark }]}>{date.getDate()}</Text>
              <DayMark status={d.status} onDark={isToday} />
            </Pressable>
          );
        })}
      </View>

      {/* Aujourd'hui : l'élément principal de l'écran */}
      {day.status === 'done' ? (
        <Panel tone="accent">
          <View style={styles.rowCenter}>
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark" size={22} color={colors.accent} />
            </View>
            <Text style={styles.doneTitle}>Séance du jour faite</Text>
          </View>
          <Text style={styles.doneText}>
            {day.log?.title}, {day.log?.durationMin} min{day.log?.kcal ? `, environ ${day.log.kcal} kcal` : ''}. Récupère bien.
          </Text>
          {upcoming?.session && (
            <Text style={styles.doneText}>
              Prochaine séance {relativeDay(upcoming.date).toLowerCase()} : {upcoming.session.title}.
            </Text>
          )}
        </Panel>
      ) : day.status === 'planned' && day.session ? (
        <Panel tone="ink" onPress={() => router.push(`/seance/d-${today}`)} group={false}>
          <View style={styles.rowBetween}>
            <Text style={styles.kicker}>Aujourd’hui</Text>
            <IconButton icon="ellipsis-horizontal" label="Options de la séance du jour" color={colors.onDark} plain onPress={() => dayActions.open(day)} />
          </View>
          <Text style={styles.heroTitle}>{day.session.title}</Text>
          <Text style={styles.heroText} numberOfLines={2}>
            {sessionSummary(day.session)}
          </Text>
          <View style={styles.heroNumbers}>
            <BigNumber value={String(estimateMinutes(day.session))} unit="min" lead />
            <BigNumber value={String(day.session.exercises.length)} unit="exercices" />
            <BigNumber value={`~${estimateKcal(day.session, data.profile.weightKg)}`} unit="kcal" />
          </View>
          {(day.modified || day.adaptations.length > 0) && (
            <View style={styles.adapted}>
              <Ionicons name="sparkles" size={14} color={colors.accent} />
              <Text style={styles.adaptedText} numberOfLines={2}>
                {day.modified ? (day.reason ?? 'Séance adaptée par le coach') : `${day.adaptations.length} exercice(s) remplacé(s) pour ménager une zone`}
              </Text>
            </View>
          )}
          <Button title="Commencer la séance" icon="play" variant="accent" big style={{ marginTop: spacing.sm }} onPress={() => router.push(`/seance/d-${today}`)} />
        </Panel>
      ) : (
        <Panel tone="surface">
          <View style={styles.rowBetween}>
            <Text style={styles.kickerMuted}>{day.status === 'skipped' ? 'Séance passée' : 'Jour de repos'}</Text>
            {day.status === 'skipped' && (
              <Pressable onPress={() => dayActions.open(day)} hitSlop={10} accessibilityRole="button" style={(s: PressState) => focusRing(s, 6)}>
                <Text style={styles.link}>Options</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.restTitle}>
            {day.status === 'skipped' ? (day.movedTo ? `Décalée à ${relativeDay(day.movedTo).toLowerCase()}` : 'Pas de séance aujourd’hui') : 'Récupération active'}
          </Text>
          <Muted>
            {next?.session
              ? `Prochaine séance ${relativeDay(next.date).toLowerCase()} : ${next.session.title}, ${estimateMinutes(next.session)} min.`
              : 'Aucune séance prévue dans les prochains jours.'}
          </Muted>
          <Text style={styles.restAsk}>Envie de bouger quand même ?</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Séance express" icon="flash" style={{ flex: 1 }} onPress={() => router.push('/seance/p-p-express')} />
            <Button title="Choisir" icon="list" variant="secondary" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/seances', params: { date: today } })} />
          </View>
        </Panel>
      )}

      {limitations.length > 0 && (
        <Notice tone="warning" title="Zones ménagées" icon="bandage">
          {limitations.map((l) => (
            <Muted key={l.id}>
              {BODY_PART_LABEL[l.bodyPart]} jusqu’au {formatKey(l.endDate, { day: 'numeric', month: 'long' })}. Les exercices qui la sollicitent sont remplacés.
            </Muted>
          ))}
        </Notice>
      )}

      {/* Coach */}
      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Un imprévu ?" />
        <Muted>Dis-le au coach, il adapte ta séance en un message.</Muted>
        <View style={styles.prompts}>
          {QUICK_PROMPTS.map((q) => (
            <Pressable
              key={q.label}
              accessibilityRole="button"
              accessibilityHint="Envoie ce message au coach"
              style={(s: PressState) => [styles.prompt, s.hovered && { borderColor: colors.borderStrong }, pressFeedback(s, 0.96), focusRing(s, radius.pill)]}
              onPress={() => askCoach(q.prompt)}
            >
              <Ionicons name={q.icon} size={15} color={colors.violet} />
              <Text style={styles.promptText}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Semaine en chiffres */}
      <SectionHeader title="Ta semaine" action="Progrès" onAction={() => router.push('/progres')} />
      <View style={styles.stats}>
        <Pressable
          style={(s: PressState) => [styles.statCell, { flex: 1.3 }, focusRing(s, radius.sm)]}
          onPress={() => router.push('/progres')}
          accessibilityRole="button"
          accessibilityLabel={`${thisWeek} séances sur ${goal} cette semaine`}
        >
          <Text style={styles.statValue}>
            {thisWeek}
            <Text style={styles.statOf}> / {goal}</Text>
          </Text>
          <Text style={styles.statLabel}>séances cette semaine</Text>
          <ProgressBar ratio={thisWeek / goal} height={6} color={colors.accent} />
        </Pressable>
        <View style={styles.statRule} />
        <Pressable style={(s: PressState) => [styles.statCell, focusRing(s, radius.sm)]} onPress={() => router.push('/progres')} accessibilityRole="button" accessibilityLabel={`${streak} semaines d’affilée`}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>semaines d’affilée</Text>
        </Pressable>
        <View style={styles.statRule} />
        <Pressable style={(s: PressState) => [styles.statCell, focusRing(s, radius.sm)]} onPress={() => router.push('/trophees')} accessibilityRole="button" accessibilityLabel={`${unlocked} succès débloqués`}>
          <Text style={styles.statValue}>{unlocked}</Text>
          <Text style={styles.statLabel}>succès</Text>
        </Pressable>
      </View>

      <SectionHeader title="Raccourcis" />
      <View style={styles.grid}>
        <Shortcut icon="albums-outline" label="Séances prêtes" onPress={() => router.push('/seances')} />
        <Shortcut icon="construct-outline" label="Créer ma séance" onPress={() => router.push('/creer-seance')} />
        <Shortcut icon="library-outline" label="Exercices" onPress={() => router.push('/exercices')} />
        <Shortcut icon="timer-outline" label="Chrono" onPress={() => router.push('/chrono')} />
      </View>
    </Screen>
  );
}

function DayMark({ status, onDark }: { status: ScheduledDay['status']; onDark: boolean }) {
  if (status === 'done')
    return (
      <View style={[styles.mark, { backgroundColor: colors.accent }]}>
        <Ionicons name="checkmark" size={10} color={colors.onAccent} />
      </View>
    );
  const c = status === 'planned' ? (onDark ? colors.onDark : colors.text) : status === 'missed' ? colors.rest : null;
  if (!c) return <View style={styles.markEmpty} />;
  return <View style={[styles.dot, { backgroundColor: c }]} />;
}

function BigNumber({ value, unit, lead }: { value: string; unit: string; lead?: boolean }) {
  return (
    <View style={styles.bigNumber} accessible accessibilityLabel={`${value.replace('~', 'environ ')} ${unit}`}>
      <Text style={[styles.bigValue, lead && styles.bigValueLead]}>{value}</Text>
      <Text style={styles.bigUnit}>{unit}</Text>
    </View>
  );
}

function Shortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={(s: PressState) => [styles.shortcut, s.hovered && { borderColor: colors.borderStrong }, pressFeedback(s, 0.97), focusRing(s, radius.md)]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
      <Text style={styles.shortcutLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  name: { color: colors.text, ...type.title },
  level: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  levelText: { color: colors.text, fontFamily: font.black, fontSize: 13 },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, gap: 4 },
  weekToday: { backgroundColor: colors.dark },
  weekLabel: { color: colors.muted, fontSize: 12, fontFamily: font.bold },
  weekNum: { color: colors.text, fontSize: 17, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  mark: { width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  markEmpty: { width: 14, height: 14 },
  dot: { width: 6, height: 6, borderRadius: 3, marginVertical: 4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms },
  kicker: { color: colors.accent, fontFamily: font.black, fontSize: 14 },
  kickerMuted: { color: colors.muted, fontFamily: font.black, fontSize: 14 },
  heroTitle: { color: colors.onDark, ...type.title, marginTop: -spacing.xs },
  heroText: { color: colors.onDarkMuted, ...type.body },
  heroNumbers: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.lg, marginTop: spacing.sm },
  bigNumber: { gap: 0 },
  bigValue: { color: colors.onDark, fontFamily: font.black, fontSize: 24, lineHeight: 28, fontVariant: ['tabular-nums'] },
  bigValueLead: { color: colors.accent, fontSize: 52, lineHeight: 54, letterSpacing: -1.5 },
  bigUnit: { color: colors.onDarkMuted, fontFamily: font.bold, fontSize: 13 },
  adapted: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs },
  adaptedText: { color: colors.onDark, fontFamily: font.bold, fontSize: 13, flex: 1 },
  doneBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.dark, alignItems: 'center', justifyContent: 'center' },
  doneTitle: { color: colors.onAccent, ...type.h2, flex: 1 },
  doneText: { color: colors.onAccent, ...type.body },
  restTitle: { color: colors.text, ...type.h2 },
  restAsk: { color: colors.text, fontFamily: font.bold, fontSize: 15, marginTop: spacing.xs },
  link: { color: colors.accentInk, fontFamily: font.bold, fontSize: 14 },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  prompt: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  promptText: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  stats: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.xs },
  statCell: { flex: 1, padding: spacing.ms, gap: 4 },
  statRule: { width: 1, backgroundColor: colors.border, marginVertical: spacing.ms },
  statValue: { color: colors.text, fontSize: 28, lineHeight: 32, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  statOf: { fontFamily: font.bold, color: colors.muted, fontSize: 16 },
  statLabel: { color: colors.muted, ...type.small, marginBottom: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  shortcut: { width: '48%', flexGrow: 1, minHeight: 88, justifyContent: 'space-between', gap: spacing.ms, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  shortcutLabel: { color: colors.text, fontFamily: font.bold, fontSize: 15 },
});
