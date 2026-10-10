import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Body,
  Button,
  Card,
  CategoryTile,
  Chip,
  Eyebrow,
  Heading,
  IconTile,
  ProgressRing,
  Row,
  Screen,
  SectionHeader,
  Title,
} from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { getExercise, ZONE_LABELS } from '@/data/exercises';
import { estimateSeconds } from '@/lib/program';
import type { Zone } from '@/lib/types';
import {
  DAY_SHORT,
  daysDoneThisWeek,
  doneToday,
  nextTrainingDayLabel,
  sessionsInWeek,
  WEEK_ORDER,
  weekStreak,
} from '@/lib/week';
import { useAppStore } from '@/store/app-store';

const TIME_OPTIONS = [10, 20, 30, 45];
const ZONES = Object.keys(ZONE_LABELS) as Zone[];

export default function Home() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const session = useAppStore((state) => state.todaySession);
  const history = useAppStore((state) => state.history);
  const isGuest = useAppStore((state) => state.isGuest);
  const regenerateSession = useAppStore((state) => state.regenerateSession);

  const [adjusting, setAdjusting] = useState(false);
  const [trainAnyway, setTrainAnyway] = useState(false);
  const [minutes, setMinutes] = useState<number | undefined>();
  const [pain, setPain] = useState<Zone[]>([]);

  if (!profile || !session) return null;

  const now = new Date();
  const today = now.getDay();
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const weekGoal = profile.trainingDays.length;
  const weekDone = sessionsInWeek(history).length;
  const streak = weekStreak(history, weekGoal);
  const doneDays = daysDoneThisWeek(history);
  const nextDay = nextTrainingDayLabel(profile.trainingDays);
  const estimatedMinutes = Math.max(1, Math.round(estimateSeconds(session.steps) / 60));
  const status = doneToday(history)
    ? 'done'
    : profile.trainingDays.includes(today)
      ? 'training'
      : 'rest';
  // La toute première séance est proposée tout de suite, même un jour de repos.
  const showSession = status === 'training' || trainAnyway || history.length === 0;

  const applyAdjustments = () => {
    regenerateSession({ minutes, extraPainZones: pain, seed: Date.now() });
    setAdjusting(false);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Eyebrow>{dateLabel}</Eyebrow>
          <Title>Salut {profile.firstName}</Title>
        </View>
        <Link href="/profile" asChild>
          <Pressable style={styles.avatar} accessibilityLabel="Mon profil">
            <Text style={styles.avatarText}>{profile.firstName.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </Link>
      </View>

      <Card>
        <View style={styles.weekTop}>
          <ProgressRing value={weekGoal ? weekDone / weekGoal : 0} size={60} stroke={7}>
            <Text style={styles.ringText}>
              {weekDone}/{weekGoal}
            </Text>
          </ProgressRing>
          <View style={styles.flex}>
            <Text style={styles.weekTitle}>
              {history.length === 0
                ? 'Ta semaine commence'
                : weekDone >= weekGoal
                  ? 'Objectif de la semaine atteint'
                  : `Encore ${weekGoal - weekDone} séance${weekGoal - weekDone > 1 ? 's' : ''} cette semaine`}
            </Text>
            <Body muted style={styles.small}>
              {history.length === 0
                ? `Première séance : environ ${estimatedMinutes} min, à ton rythme.`
                : `${weekDone} sur ${weekGoal} séances prévues`}
            </Body>
          </View>
          {streak > 0 && <Badge tone="accent" icon="flame" label={`${streak} sem.`} />}
        </View>
        <View style={styles.week}>
          {WEEK_ORDER.map((day) => {
            const planned = profile.trainingDays.includes(day);
            const done = doneDays.has(day);
            const isToday = day === today;
            return (
              <View key={day} style={styles.day}>
                <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{DAY_SHORT[day]}</Text>
                <View
                  style={[
                    styles.dayCircle,
                    planned && styles.dayPlanned,
                    isToday && styles.dayToday,
                    done && styles.dayDone,
                  ]}
                  accessibilityLabel={done ? 'séance faite' : planned ? 'séance prévue' : 'repos'}>
                  {done ? (
                    <Ionicons name="checkmark" size={16} color={Colors.ink} />
                  ) : planned ? (
                    <View style={[styles.plannedDot, isToday && styles.plannedDotToday]} />
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {!showSession && (
        <Card>
          <View style={styles.restRow}>
            <IconTile
              icon={status === 'done' ? 'checkmark-done' : 'moon'}
              tint={status === 'done' ? Colors.accentSoft : Colors.surface}
              color={status === 'done' ? Colors.accentDeep : Colors.text}
            />
            <View style={styles.flex}>
              <Heading>{status === 'done' ? 'Séance faite, bravo !' : 'Jour de repos'}</Heading>
              {nextDay && <Body muted style={styles.small}>Prochaine séance : {nextDay}</Body>}
            </View>
          </View>
          <Body muted>
            {status === 'done'
              ? 'Le repos fait partie du programme : tes muscles se renforcent pendant la récupération.'
              : 'Récupérer est aussi important que s\'entraîner.'}
          </Body>
          <Button
            label="M'entraîner quand même"
            icon="flash"
            variant="secondary"
            onPress={() => setTrainAnyway(true)}
          />
        </Card>
      )}

      {showSession && (
        <Card variant="dark" style={styles.hero}>
          <Text style={styles.heroEyebrow}>
            {session.title === 'Séance du jour' ? 'Aujourd\'hui' : session.title}
          </Text>
          <Text style={styles.heroTitle}>
            {history.length === 0 ? 'Ta première séance' : 'Ta séance du jour'}
          </Text>
          <Row>
            <Badge tone="dark" icon="time-outline" label={`${estimatedMinutes} min`} />
            <Badge tone="dark" icon="list-outline" label={`${session.steps.length} exercices`} />
            {session.avoidedZones.length > 0 && (
              <Badge
                tone="dark"
                icon="shield-checkmark-outline"
                label={`Ménage ${session.avoidedZones.map((z) => ZONE_LABELS[z].toLowerCase()).join(', ')}`}
              />
            )}
          </Row>
          <Button
            label="Commencer"
            icon="play"
            variant="accent"
            onPress={() => router.push('/session')}
            style={styles.heroButton}
          />
          <Row style={styles.nowrap}>
            <Button
              label={adjusting ? 'Fermer' : 'Adapter'}
              icon={adjusting ? 'close' : 'options-outline'}
              variant="onDark"
              size="sm"
              onPress={() => setAdjusting(!adjusting)}
              style={styles.flex}
            />
            <Button
              label="Modifier"
              icon="create-outline"
              variant="onDark"
              size="sm"
              onPress={() => router.push('/edit-session')}
              style={styles.flex}
            />
          </Row>
        </Card>
      )}

      {showSession && adjusting && (
        <Card>
          <Heading>Combien de temps aujourd&apos;hui ?</Heading>
          <Row>
            {TIME_OPTIONS.map((value) => (
              <Chip
                key={value}
                label={`${value} min`}
                selected={minutes === value}
                onPress={() => setMinutes(minutes === value ? undefined : value)}
              />
            ))}
          </Row>
          <Heading>Une douleur aujourd&apos;hui ?</Heading>
          <Row>
            {ZONES.map((zone) => (
              <Chip
                key={zone}
                label={ZONE_LABELS[zone]}
                selected={pain.includes(zone)}
                onPress={() =>
                  setPain(pain.includes(zone) ? pain.filter((z) => z !== zone) : [...pain, zone])
                }
              />
            ))}
          </Row>
          <Body muted style={styles.small}>
            Si une douleur est forte ou dure plusieurs jours, demande l&apos;avis d&apos;un médecin
            ou d&apos;un kiné.
          </Body>
          <Button label="Générer ma séance adaptée" icon="sparkles" onPress={applyAdjustments} />
        </Card>
      )}

      {showSession && (
        <>
          <SectionHeader title="Au programme" />
          <Card style={styles.list}>
            {session.steps.map((step, index) => {
              const exercise = getExercise(step.exerciseId);
              if (!exercise) return null;
              const amount = exercise.mode === 'time' ? `${step.amount} s` : `${step.amount} rép.`;
              return (
                <Link
                  key={`${step.exerciseId}-${index}`}
                  href={{ pathname: '/exercise/[id]', params: { id: exercise.id } }}
                  asChild>
                  <Pressable style={styles.listRow}>
                    <CategoryTile category={exercise.category} size={42} />
                    <View style={styles.flex}>
                      <Text style={styles.listName}>{exercise.name}</Text>
                      <Text style={styles.listMeta}>
                        {step.sets} × {amount}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
                  </Pressable>
                </Link>
              );
            })}
          </Card>
        </>
      )}

      {isGuest && (
        <View style={styles.banner}>
          <Ionicons name="phone-portrait-outline" size={18} color={Colors.textSecondary} />
          <Text style={styles.bannerText}>
            Sans compte, ta progression reste sur ce téléphone. Les comptes arrivent bientôt.
          </Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  nowrap: { flexWrap: 'nowrap' },
  small: { fontSize: 14, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.accent },
  weekTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  ringText: { fontFamily: Fonts.extrabold, fontSize: 15, color: Colors.text },
  weekTitle: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 21, color: Colors.text },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  day: { alignItems: 'center', gap: 6 },
  dayLabel: { fontFamily: Fonts.medium, fontSize: 12, color: Colors.textSecondary },
  dayLabelToday: { fontFamily: Fonts.extrabold, color: Colors.text },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPlanned: { borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.card },
  dayToday: { borderWidth: 2, borderColor: Colors.ink },
  dayDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  plannedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textSecondary },
  plannedDotToday: { backgroundColor: Colors.ink },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  hero: { padding: Spacing.lg, gap: Spacing.md },
  heroEyebrow: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heroTitle: { fontFamily: Fonts.extrabold, fontSize: 28, lineHeight: 33, color: Colors.white, letterSpacing: -0.6 },
  heroButton: { marginTop: Spacing.xs },
  list: { paddingVertical: Spacing.sm, gap: 0 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10 },
  listName: { fontFamily: Fonts.semibold, fontSize: 16, color: Colors.text },
  listMeta: { fontFamily: Fonts.regular, fontSize: 14, color: Colors.textSecondary, marginTop: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bannerText: { flex: 1, fontFamily: Fonts.regular, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
});
