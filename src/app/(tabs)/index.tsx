import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, EditorialCard, workoutImage } from '@/components/brand';
import { askCoach, useDayActions } from '@/components/DayActions';
import { Notice, ProgressBar, SectionHeader } from '@/components/kit';
import { Button, Card, H2, IconButton, Muted, Screen } from '@/components/ui';
import { DAY_SHORT } from '@/data/generator';
import { addDays, dateKey, greeting, parseKey, relativeDay } from '@/lib/date';
import { focusRing, PressState, pressFeedback } from '@/lib/motion';
import { getDay, nextSession, weekDays } from '@/lib/schedule';
import { sessionsThisWeek, weekStreak } from '@/lib/stats';
import { estimateMinutes } from '@/lib/workout';
import { useApp } from '@/store/AppStore';
import { useSessionDraft } from '@/store/SessionDraftStore';
import { colors, font, radius, spacing } from '@/theme';

export default function Home() {
  const { data } = useApp();
  const { draft } = useSessionDraft();
  const dayActions = useDayActions();
  const today = dateKey();
  const day = getDay(data, today);
  const next = day.status === 'planned' ? day : nextSession(data, addDays(today, 1));
  const count = sessionsThisWeek(data.logs);
  const goal = data.profile.sessionsPerWeek;
  const limitations = data.limitations.filter((l) => l.endDate >= today);
  return (
    <Screen>
      {dayActions.element}
      <View style={s.row}>
        <BrandLogo compact />
        <View style={{ flex: 1 }} />
        <IconButton icon="settings-outline" label="Réglages" onPress={() => router.push('/reglages')} />
      </View>
      <View style={{ gap: 5 }}>
        <Muted>{greeting()}{data.profile.name ? ', ' + data.profile.name : ''}</Muted>
        <Text role="heading" aria-level={1} style={s.headline}>Un peu mieux.{'\n'}<Text style={{ color: colors.accent }}> Chaque jour.</Text></Text>
      </View>
      <View style={s.week}>
        {weekDays(data).map((d) => {
          const active = d.date === today;
          const completed = d.status === 'done';
          return <Pressable key={d.date} onPress={() => d.session && d.status !== 'done' ? router.push(`/seance/d-${d.date}`) : dayActions.open(d)} accessibilityRole="button" accessibilityLabel={relativeDay(d.date) + (completed ? ', séance faite' : d.session ? ', séance prévue' : ', repos')} style={(st: PressState) => [s.day, active && s.dayActive, pressFeedback(st), focusRing(st, radius.md)]}>
            <Text style={[s.dayName, active && { color: colors.onAccent }]}>{DAY_SHORT[(parseKey(d.date).getDay() + 6) % 7]}</Text>
            <Text style={[s.dayNumber, active && { color: colors.onAccent }]}>{parseKey(d.date).getDate()}</Text>
            <View style={[s.dot, { backgroundColor: completed || d.session ? active ? colors.onAccent : colors.accent : 'transparent' }]} />
          </Pressable>;
        })}
      </View>
      {draft && <Card>
        <Text style={s.eyebrow}>ON REPREND ?</Text>
        <H2>{draft.resolved.session.title}</H2>
        <Muted>Ta progression est conservée sur cet appareil.</Muted>
        <Button title="Reprendre ma séance" icon="play" onPress={() => router.push(`/seance/${draft.routeId}`)} />
      </Card>}
      {day.status === 'done' && <Notice tone="success" title="C’est fait pour aujourd’hui.">{<Muted>{day.log?.durationMin} minutes pour toi. Place à la récupération.</Muted>}</Notice>}
      {next?.session ? <EditorialCard
        kicker={next.date === today ? 'TA SÉANCE DU JOUR' : 'PROCHAINE SÉANCE · ' + relativeDay(next.date)}
        image={workoutImage(next.session.title)} title={next.session.title}
        subtitle={estimateMinutes(next.session) + ' min · ' + next.session.exercises.length + ' exercices'}
        action="Découvrir ma séance"
        onPress={() => router.push(`/seance/d-${next.date}`)}
      /> : <EditorialCard kicker="CHAQUE MOUVEMENT COMPTE" title="Bouge à ton rythme." subtitle="Quelques minutes suffisent pour prendre du temps pour toi." action="Trouver une séance" onPress={() => router.push('/seances')} />}
      {day.status === 'rest' && <Muted>Aujourd’hui, c’est repos. Tu peux aussi choisir une séance douce dans la bibliothèque.</Muted>}
      <Pressable accessibilityRole="button" accessibilityLabel="Parler à mon coach Mova" onPress={() => askCoach('Je voudrais adapter ma séance : ')} style={(st: PressState) => [s.coach, pressFeedback(st), focusRing(st, radius.md)]}>
        <View style={s.coachIcon}><Ionicons name="sparkles" size={22} color={colors.violet} /></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={s.coachTitle}>Ta vie change. Ton programme aussi.</Text><Muted>15 minutes ? Pas de matériel ? Parlons-en.</Muted></View>
        <Ionicons name="arrow-forward" size={20} color={colors.violet} />
      </Pressable>
      {limitations.length > 0 && <Notice tone="warning" title="Un programme qui te ménage"><Muted>{limitations.length} zone(s) prise(s) en compte dans tes exercices. Retrouve les détails dans Programme.</Muted></Notice>}
      <SectionHeader title="La régularité, à ton rythme" action="Mes progrès" onAction={() => router.push('/progres')} />
      <Card>
        <View style={s.row}><Text style={s.score}>{count}<Text style={s.scoreTotal}> / {goal}</Text></Text><View style={{ flex: 1 }} /><View style={{ alignItems: 'flex-end', gap: 4 }}><Text style={s.statTitle}>séances cette semaine</Text><Muted>{weekStreak(data.logs, goal)} semaine(s) de régularité</Muted></View></View>
        <ProgressBar ratio={count / goal} color={colors.accent} height={6} label={count + ' séances sur ' + goal + ' cette semaine'} />
      </Card>
      <View style={s.links}>
        <Button title="Séances à explorer" icon="albums-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/seances')} />
        <Button title="Mes repas" icon="restaurant-outline" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/nutrition')} />
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headline: { color: colors.text, fontFamily: font.black, fontSize: 30, lineHeight: 35, letterSpacing: -0.8, maxWidth: 360 },
  week: { flexDirection: 'row', gap: 5 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 7, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  dayActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayName: { color: colors.muted, fontFamily: font.bold, fontSize: 11 },
  dayNumber: { color: colors.text, fontFamily: font.black, fontSize: 17 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  eyebrow: { color: colors.accent, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.4 },
  coach: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.md, backgroundColor: colors.violetDim, borderWidth: 1, borderColor: '#3B324D' },
  coachIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#342C43' },
  coachTitle: { color: colors.text, fontFamily: font.bold, fontSize: 15, lineHeight: 20 },
  score: { color: colors.accent, fontFamily: font.black, fontSize: 34 },
  scoreTotal: { color: colors.muted, fontSize: 20 },
  statTitle: { color: colors.text, fontFamily: font.bold, fontSize: 13 },
  links: { flexDirection: 'row', gap: spacing.sm },
});
