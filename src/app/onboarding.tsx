import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, ScrollViewInstance, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo, EditorialCard } from '@/components/brand';
import { Field, OptionCard, Panel, ProgressBar } from '@/components/kit';
import { Button, Chip, frenchSpacing, IconButton, IconName, Muted } from '@/components/ui';
import { BODY_PART_LABEL, EQUIPMENT_LABEL } from '@/data/exercises';
import { DAY_SHORT, defaultDays, GOAL_LABEL, LEVEL_LABEL } from '@/data/generator';
import { addDays, dateKey } from '@/lib/date';
import { JOB_LABEL } from '@/lib/nutrition';
import { DEFAULT_PROFILE, useApp } from '@/store/AppStore';
import type { BodyPart, Equipment, Goal, JobActivity, Level, Limitation, Place, Profile, SportHistory } from '@/store/types';
import { colors, font, layout, radius, spacing, type } from '@/theme';

const GOALS: { id: Goal; icon: IconName; sub: string }[] = [
  { id: 'forme', icon: 'sunny', sub: 'Retrouver de l’énergie et bouger plus' },
  { id: 'perte', icon: 'flame', sub: 'Brûler des calories, s’affiner' },
  { id: 'muscle', icon: 'barbell', sub: 'Construire du muscle' },
  { id: 'force', icon: 'fitness', sub: 'Soulever plus lourd' },
  { id: 'endurance', icon: 'pulse', sub: 'Tenir plus longtemps, mieux respirer' },
  { id: 'sante', icon: 'heart', sub: 'Prendre soin de mon corps sur la durée' },
];

const HISTORY: { id: SportHistory; title: string; sub: string; level: Level }[] = [
  { id: 'jamais', title: 'Jamais ou presque', sub: 'Je pars de zéro, et c’est très bien', level: 'debutant' },
  { id: 'parfois', title: 'De temps en temps', sub: 'J’ai déjà pratiqué, sans régularité', level: 'intermediaire' },
  { id: 'regulier', title: 'Régulièrement', sub: 'Je m’entraîne déjà chaque semaine', level: 'confirme' },
];

const PLACES: { id: Place; icon: IconName; title: string; sub: string }[] = [
  { id: 'maison', icon: 'home', title: 'À la maison', sub: 'Dans le salon, la chambre…' },
  { id: 'salle', icon: 'business', title: 'En salle de sport', sub: 'Machines, barres, haltères' },
  { id: 'exterieur', icon: 'leaf', title: 'Dehors', sub: 'Parc, jardin, street workout' },
];

const DURATIONS = [10, 15, 20, 30, 45, 60, 75, 90];
const PAIN_DURATIONS = [
  { label: '1 semaine', days: 7 },
  { label: '2 semaines', days: 14 },
  { label: '1 mois', days: 30 },
];


export default function Onboarding() {
  const { data, completeOnboarding } = useApp();
  const [step, setStep] = useState(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  const [p, setP] = useState<Profile>({ ...DEFAULT_PROFILE, ...data.profile });
  const [pains, setPains] = useState<BodyPart[]>([]);
  const [painDays, setPainDays] = useState(14);
  const [ageText, setAgeText] = useState(String(p.age));
  const [heightText, setHeightText] = useState(String(p.heightCm));
  const [weightText, setWeightText] = useState(String(p.weightKg));

  const set = (patch: Partial<Profile>) => setP((cur) => ({ ...cur, ...patch }));
  const TOTAL = 9;

  const num = (t: string, min: number, max: number) => {
    const v = parseFloat(t.replace(',', '.'));
    return Number.isFinite(v) && v >= min && v <= max ? v : undefined;
  };
  const bodyValid = num(ageText, 12, 100) && num(heightText, 120, 230) && num(weightText, 30, 300);

  const canNext = [
    true,
    true,
    true,
    !!bodyValid,
    true,
    p.trainingDays.length === p.sessionsPerWeek,
    true,
    true,
    true,
  ][step];

  const next = () => {
    if (step === 3) set({ age: Math.round(num(ageText, 12, 100)!), heightCm: Math.round(num(heightText, 120, 230)!), weightKg: Math.round(num(weightText, 30, 300)! * 10) / 10 });
    if (step < TOTAL - 1) setStep(step + 1);
    else {
      const today = dateKey();
      const limitations: Omit<Limitation, 'id'>[] = pains.map((b) => ({ bodyPart: b, note: 'Signalé à l’inscription', startDate: today, endDate: addDays(today, painDays) }));
      completeOnboarding(p, limitations);
      router.replace('/programme');
    }
  };

  const toggleEquip = (e: Equipment) => set({ equipment: p.equipment.includes(e) ? p.equipment.filter((x) => x !== e) : [...p.equipment, e] });
  const toggleDay = (d: number) => {
    const days = p.trainingDays.includes(d) ? p.trainingDays.filter((x) => x !== d) : [...p.trainingDays, d].sort();
    set({ trainingDays: days });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          {step > 0 ? <IconButton icon="arrow-back" label="Retour" onPress={() => setStep(step - 1)} /> : <View style={{ width: 40 }} />}
          <View style={{ flex: 1 }}>
            <ProgressBar ratio={(step + 1) / TOTAL} color={colors.dark} height={6} label={`Étape ${step + 1} sur ${TOTAL}`} />
          </View>
          <Text style={styles.stepCount}>
            {step + 1}/{TOTAL}
          </Text>
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === 0 && (
            <>
              <View style={styles.welcome}>
                <BrandLogo />
                <Text style={styles.welcomeTitle} role="heading" aria-level={1}>
                  Du mouvement. À ta mesure.
                </Text>
                <Text style={styles.welcomeText}>Un programme qui suit ta vraie vie. On fait connaissance, puis on trouve ton rythme.</Text>
                <EditorialCard kicker="TON NOUVEAU DÉPART" title="Chaque mouvement compte." />
              </View>
              <Title>Comment je t’appelle ?</Title>
              <Field value={p.name} onChangeText={(name) => set({ name })} placeholder="Ton prénom" autoFocus returnKeyType="next" onSubmitEditing={next} />
              <Muted>Quelques questions simples (2 minutes) pour créer un programme fait pour toi. Tout reste modifiable ensuite, il suffira de le dire au coach.</Muted>
            </>
          )}

          {step === 1 && (
            <>
              <Title>Quel est ton objectif principal ?</Title>
              {GOALS.map((g) => (
                <OptionCard key={g.id} title={GOAL_LABEL[g.id]} subtitle={g.sub} icon={g.icon} selected={p.goal === g.id} onPress={() => set({ goal: g.id })} />
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <Title>Tu fais du sport ?</Title>
              {HISTORY.map((h) => (
                <OptionCard key={h.id} title={h.title} subtitle={h.sub} selected={p.history === h.id} onPress={() => set({ history: h.id, level: h.level })} />
              ))}
              <Text style={styles.label}>Ton niveau</Text>
              <View style={styles.chips}>
                {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                  <Chip key={l} label={LEVEL_LABEL[l]} active={p.level === l} onPress={() => set({ level: l })} />
                ))}
              </View>
              <Muted>Dans le doute, choisis le niveau en dessous : le coach fera monter la difficulté.</Muted>
            </>
          )}

          {step === 3 && (
            <>
              <Title>Parle-moi un peu de toi</Title>
              <Muted>Ça sert à doser tes séances et à calculer tes besoins caloriques.</Muted>
              <View style={styles.chips}>
                {(['homme', 'femme', 'autre'] as const).map((s) => (
                  <Chip key={s} label={s === 'homme' ? 'Homme' : s === 'femme' ? 'Femme' : 'Autre'} active={p.sex === s} onPress={() => set({ sex: s })} />
                ))}
              </View>
              <View style={styles.row3}>
                <View style={{ flex: 1 }}>
                  <Field label="Âge" value={ageText} onChangeText={setAgeText} keyboardType="number-pad" maxLength={3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Taille (cm)" value={heightText} onChangeText={setHeightText} keyboardType="number-pad" maxLength={3} />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Poids (kg)" value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" maxLength={5} />
                </View>
              </View>
              {!bodyValid && (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  Vérifie tes valeurs : âge de 12 à 100 ans, taille de 120 à 230 cm, poids de 30 à 300 kg.
                </Text>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <Title>Où vas-tu t’entraîner ?</Title>
              {PLACES.map((pl) => (
                <OptionCard
                  key={pl.id}
                  title={pl.title}
                  subtitle={pl.sub}
                  icon={pl.icon}
                  selected={p.place === pl.id}

                  onPress={() => set({ place: pl.id, equipment: pl.id === 'salle' ? (Object.keys(EQUIPMENT_LABEL) as Equipment[]) : p.place === 'salle' ? [] : p.equipment })}
                />
              ))}
              <Text style={styles.label}>Matériel disponible</Text>
              <View style={styles.chips}>
                {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => (
                  <Chip key={e} label={EQUIPMENT_LABEL[e]} active={p.equipment.includes(e)} onPress={() => toggleEquip(e)} />
                ))}
              </View>
              <Muted>{p.equipment.length ? `${p.equipment.length} élément(s) sélectionné(s).` : 'Rien de coché : tes séances seront 100 % au poids du corps.'}</Muted>
            </>
          )}

          {step === 5 && (
            <>
              <Title>Quel rythme ?</Title>
              <Text style={styles.label}>Séances par semaine</Text>
              <View style={styles.chips}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <Chip key={n} label={`${n}`} active={p.sessionsPerWeek === n} onPress={() => set({ sessionsPerWeek: n, trainingDays: defaultDays(n) })} />
                ))}
              </View>
              <Text style={styles.label}>Durée d’une séance</Text>
              <View style={styles.chips}>
                {DURATIONS.map((m) => (
                  <Chip key={m} label={`${m} min`} active={p.sessionMinutes === m} onPress={() => set({ sessionMinutes: m })} />
                ))}
              </View>
              <Text style={styles.label}>Quels jours ?</Text>
              <View style={styles.chips}>
                {DAY_SHORT.map((d, i) => (
                  <Chip key={d} label={d} active={p.trainingDays.includes(i)} onPress={() => toggleDay(i)} />
                ))}
              </View>
              {p.trainingDays.length !== p.sessionsPerWeek && (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  Choisis {p.sessionsPerWeek} jour{p.sessionsPerWeek > 1 ? 's' : ''} ({p.trainingDays.length} sélectionné{p.trainingDays.length > 1 ? 's' : ''}).
                </Text>
              )}
              {p.history === 'jamais' && p.sessionsPerWeek > 3 && <Muted>Astuce : pour démarrer, 2 à 3 séances par semaine suffisent largement.</Muted>}
            </>
          )}

          {step === 6 && (
            <>
              <Title>Une douleur ou une zone à ménager ?</Title>
              <Muted>Facultatif. Les exercices qui sollicitent ces zones seront remplacés automatiquement.</Muted>
              <View style={styles.chips}>
                {(Object.keys(BODY_PART_LABEL) as BodyPart[]).map((b) => (
                  <Chip
                    key={b}
                    label={BODY_PART_LABEL[b]}
                    active={pains.includes(b)}
                    onPress={() => setPains((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]))}

                  />
                ))}
              </View>
              {pains.length > 0 && (
                <>
                  <Text style={styles.label}>Pendant combien de temps ?</Text>
                  <View style={styles.chips}>
                    {PAIN_DURATIONS.map((d) => (
                      <Chip key={d.days} label={d.label} active={painDays === d.days} onPress={() => setPainDays(d.days)} />
                    ))}
                  </View>
                  <Muted>En cas de douleur vive ou persistante, demande l’avis d’un médecin ou d’un kiné.</Muted>
                </>
              )}
            </>
          )}

          {step === 7 && (
            <>
              <Title>Et ton quotidien ?</Title>
              {(Object.keys(JOB_LABEL) as JobActivity[]).map((j) => (
                <OptionCard
                  key={j}
                  title={JOB_LABEL[j]}
                  icon={j === 'assis' ? 'desktop' : j === 'debout' ? 'walk' : 'hammer'}
                  selected={p.job === j}
                  onPress={() => set({ job: j })}

                />
              ))}
              <Text style={styles.label}>Nutrition</Text>
              <OptionCard
                multiple
                title="Je veux de l’aide pour mon alimentation"
                subtitle="Besoins caloriques et menus adaptés à tes goûts"
                icon="restaurant"
                selected={p.wantsNutrition}
                onPress={() => set({ wantsNutrition: !p.wantsNutrition })}
              />
            </>
          )}

          {step === 8 && (
            <>
              <Title>{`Ton programme est prêt${p.name ? `, ${p.name}` : ''} !`}</Title>
              <View style={styles.summary}>
                <SummaryRow icon="flag" label="Objectif" value={GOAL_LABEL[p.goal]} />
                <SummaryRow icon="stats-chart" label="Niveau" value={LEVEL_LABEL[p.level]} />
                <SummaryRow icon="calendar" label="Rythme" value={`${p.sessionsPerWeek}×/sem · ${p.sessionMinutes} min · ${p.trainingDays.map((d) => DAY_SHORT[d]).join(', ')}`} />
                <SummaryRow icon="barbell" label="Matériel" value={p.equipment.length ? p.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ') : 'Poids du corps'} />
                {pains.length > 0 && <SummaryRow icon="bandage" label="À ménager" value={pains.map((b) => BODY_PART_LABEL[b]).join(', ')} />}
              </View>
              <Panel tone="surface">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="sparkles" size={20} color={colors.violet} />
                  <Text style={styles.coachTitle}>Ton coach t’accompagne</Text>
                </View>
                <Text style={styles.coachText}>
                  « J’ai que 15 min », « pas de matériel aujourd’hui », « j’ai mal au poignet »… Dis-le simplement au coach, il adapte tout ton programme.
                </Text>
              </Panel>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerInner}>
            <Button title={step === TOTAL - 1 ? 'Voir mon programme' : 'Continuer'} big onPress={next} disabled={!canNext} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Title({ children }: { children: string }) {
  return (
    <Text style={styles.title} role="heading" aria-level={1}>
      {frenchSpacing(children)}
    </Text>
  );
}

function SummaryRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Ionicons name={icon} size={18} color={colors.muted} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  stepCount: { color: colors.muted, fontFamily: font.bold, minWidth: 32, textAlign: 'right', fontVariant: ['tabular-nums'] },
  content: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', padding: spacing.md, paddingTop: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  welcome: { gap: spacing.md, paddingVertical: spacing.md },
  mark: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  welcomeTitle: { color: colors.text, ...type.display },
  welcomeText: { color: colors.muted, ...type.body, fontSize: 16, lineHeight: 24 },
  coachTitle: { color: colors.text, ...type.h3, fontFamily: font.black },
  coachText: { color: colors.muted, ...type.body },
  title: { color: colors.text, ...type.title },
  label: { color: colors.text, fontFamily: font.black, fontSize: 15, marginTop: spacing.sm },
  error: { color: colors.danger, ...type.small, fontFamily: font.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row3: { flexDirection: 'row', gap: spacing.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  footerInner: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
  summary: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  summaryLabel: { color: colors.muted, width: 80, fontFamily: font.bold },
  summaryValue: { color: colors.text, flex: 1, fontFamily: font.bold },
});
