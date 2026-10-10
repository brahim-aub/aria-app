import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Chip, Row, Title } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { EQUIPMENT_LABELS, GOAL_LABELS, MINUTE_OPTIONS } from '@/lib/labels';
import { remindersSupported, syncReminders } from '@/lib/reminders';
import type { Consent, Level, Profile } from '@/lib/types';
import { DAY_SHORT, WEEK_ORDER } from '@/lib/week';
import { TEST_PROFILE, useAppStore } from '@/store/app-store';

type Answers = Record<string, unknown>;
type Option = { label: string; value: unknown };

interface BaseStep {
  key: string;
  question: (answers: Answers) => string;
  /** Question sautée selon les réponses précédentes. */
  skip?: (answers: Answers) => boolean;
  /** Message du coach ajouté juste après la réponse. */
  after?: (answers: Answers) => string | null;
}

type Step = BaseStep &
  (
    | { kind: 'text' }
    | { kind: 'number'; unit: string; min: number; max: number }
    | { kind: 'choice'; options: Option[]; optional?: boolean }
    | { kind: 'multi'; options: Option[]; noneLabel: string }
    | { kind: 'days' }
    | { kind: 'consent' }
  );

const SAFETY_KEYS = ['safety_heart', 'safety_chest', 'safety_recent'];
const YES_NO: Option[] = [
  { label: 'Oui', value: true },
  { label: 'Non', value: false },
];
const skipMeasurements = (answers: Answers) => answers.wantsMeasurements !== true;

/**
 * Onboarding scénarisé, présenté comme une conversation avec le coach.
 * Quand le fournisseur d'IA sera choisi, le coach pourra reformuler et relancer librement.
 */
const STEPS: Step[] = [
  {
    key: 'firstName',
    kind: 'text',
    question: () => 'Salut ! Moi c\'est Aria, ton coach. Comment tu t\'appelles ?',
  },
  {
    key: 'goal',
    kind: 'choice',
    question: (a) => `Enchanté ${a.firstName} ! Qu'est-ce qui te motive à te lancer ?`,
    options: Object.entries(GOAL_LABELS).map(([value, label]) => ({ label, value })),
  },
  {
    key: 'level',
    kind: 'choice',
    question: () => 'Tu fais du sport en ce moment ?',
    options: [
      { label: 'Pas du tout', value: 1 },
      { label: 'Un peu', value: 2 },
      { label: 'Régulièrement', value: 3 },
    ],
  },
  {
    key: 'trainingDays',
    kind: 'days',
    question: () =>
      'Quels jours tu veux t\'entraîner ? Deux ou trois jours pour commencer, c\'est très bien.',
  },
  {
    key: 'minutesPerSession',
    kind: 'choice',
    question: () => 'Combien de temps par séance ?',
    options: MINUTE_OPTIONS.map((minutes) => ({ label: `${minutes} min`, value: minutes })),
  },
  {
    key: 'equipment',
    kind: 'multi',
    question: () => 'Tu as du matériel chez toi ? Tu peux en choisir plusieurs.',
    options: Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ label, value })),
    noneLabel: 'Rien du tout',
  },
  {
    key: 'painZones',
    kind: 'multi',
    question: () =>
      'Tu as des douleurs ou des zones fragiles ? Je choisirai des exercices qui les ménagent.',
    options: [
      { label: 'Poignets', value: 'poignets' },
      { label: 'Genoux', value: 'genoux' },
      { label: 'Dos', value: 'dos' },
      { label: 'Épaules', value: 'epaules' },
    ],
    noneLabel: 'Aucune',
    after: (a) =>
      (a.painZones as string[]).length > 0
        ? 'C\'est noté. Je propose des exercices, pas un diagnostic : si une douleur est vive ou ne passe pas, consulte un professionnel de santé.'
        : null,
  },
  {
    key: 'safety_heart',
    kind: 'choice',
    question: () =>
      'Trois questions rapides pour ta sécurité. Un médecin t\'a-t-il déjà déconseillé le sport, ou parlé d\'un problème au cœur ?',
    options: YES_NO,
  },
  {
    key: 'safety_chest',
    kind: 'choice',
    question: () => 'As-tu déjà eu une douleur à la poitrine, un malaise ou des vertiges pendant un effort ?',
    options: YES_NO,
  },
  {
    key: 'safety_recent',
    kind: 'choice',
    question: () => 'Es-tu enceinte, ou as-tu été opéré·e ou blessé·e ces derniers mois ?',
    options: YES_NO,
    after: (a) =>
      SAFETY_KEYS.some((key) => a[key] === true)
        ? 'Merci de ta franchise. Avant de commencer, demande l\'avis de ton médecin. En attendant, je te propose des séances douces, et tu peux arrêter à tout moment.'
        : null,
  },
  {
    key: 'wantsMeasurements',
    kind: 'choice',
    question: () =>
      'Je peux aussi estimer tes besoins en calories. Il me faut ton sexe, ton âge, ta taille et ton poids. C\'est facultatif.',
    options: [
      { label: 'D\'accord', value: true },
      { label: 'Plus tard', value: false },
    ],
  },
  {
    key: 'sex',
    kind: 'choice',
    question: () => 'Tu es…',
    options: [
      { label: 'Un homme', value: 'homme' },
      { label: 'Une femme', value: 'femme' },
    ],
    optional: true,
    skip: skipMeasurements,
  },
  { key: 'age', kind: 'number', question: () => 'Quel âge as-tu ?', unit: 'ans', min: 16, max: 99, skip: skipMeasurements },
  {
    key: 'heightCm',
    kind: 'number',
    question: () => 'Combien tu mesures ?',
    unit: 'cm',
    min: 120,
    max: 230,
    skip: skipMeasurements,
  },
  {
    key: 'weightKg',
    kind: 'number',
    question: () => 'Et ton poids ? Ça reste sur ton téléphone.',
    unit: 'kg',
    min: 30,
    max: 250,
    skip: skipMeasurements,
  },
  {
    key: 'reminderEnabled',
    kind: 'choice',
    question: () => 'Je t\'envoie un petit rappel à 18 h les jours de séance ?',
    options: [
      { label: 'Oui', value: true },
      { label: 'Non merci', value: false },
    ],
    skip: () => !remindersSupported,
  },
  {
    key: 'consent',
    kind: 'consent',
    question: (a) =>
      `Dernière étape, ${a.firstName} : tes réponses restent sur ton téléphone. J'ai besoin de ton accord pour les utiliser.`,
  },
];

function nextIndex(from: number, answers: Answers) {
  let index = from + 1;
  while (index < STEPS.length && STEPS[index].skip?.(answers)) index += 1;
  return index;
}

function toProfile(answers: Answers): Profile {
  const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null);
  return {
    firstName: String(answers.firstName ?? ''),
    goal: (answers.goal as Profile['goal']) ?? 'forme',
    level: (answers.level as Level) ?? 1,
    // En cas de signal de sécurité, on démarre avec les variantes les plus douces.
    ...(SAFETY_KEYS.some((key) => answers[key] === true) ? { level: 1 as Level } : {}),
    trainingDays: (answers.trainingDays as number[]) ?? [1, 3, 5],
    minutesPerSession: (answers.minutesPerSession as number) ?? 20,
    equipment: (answers.equipment as Profile['equipment']) ?? [],
    painZones: (answers.painZones as Profile['painZones']) ?? [],
    sex: (answers.sex as Profile['sex']) ?? null,
    age: numberOrNull(answers.age),
    heightCm: numberOrNull(answers.heightCm),
    weightKg: numberOrNull(answers.weightKg),
    reminderEnabled: answers.reminderEnabled === true,
    reminderHour: 18,
  };
}

type Message = { from: 'coach' | 'user'; text: string };
type Answer = (value: unknown, label: string) => void;

/** Zone de réponse d'une question ; remontée à chaque question grâce à sa `key`. */
function StepInput({
  step,
  onAnswer,
  onConsent,
}: {
  step: Step;
  onAnswer: Answer;
  onConsent: (consent: Consent) => void;
}) {
  const [text, setText] = useState('');
  const [multi, setMulti] = useState<unknown[]>([]);
  const [healthData, setHealthData] = useState(false);
  const [analytics, setAnalytics] = useState(false);

  const toggle = (value: unknown) =>
    setMulti(multi.includes(value) ? multi.filter((v) => v !== value) : [...multi, value]);

  if (step.kind === 'text') {
    const value = text.trim();
    return (
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ton prénom"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={() => value && onAnswer(value, value)}
        />
        <Button label="OK" disabled={!value} onPress={() => onAnswer(value, value)} />
      </View>
    );
  }

  if (step.kind === 'number') {
    const value = Number(text.replace(',', '.'));
    const valid =
      text.trim() !== '' && Number.isFinite(value) && value >= step.min && value <= step.max;
    return (
      <>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={step.unit}
            keyboardType="numeric"
            autoFocus
          />
          <Button
            label="OK"
            disabled={!valid}
            onPress={() => onAnswer(Math.round(value), `${text.trim()} ${step.unit}`)}
          />
        </View>
        <View style={styles.hintRow}>
          <Text style={[styles.hint, text.trim() !== '' && !valid && styles.hintError]}>
            Entre {step.min} et {step.max} {step.unit}
          </Text>
          <Pressable onPress={() => onAnswer(null, 'Je préfère ne pas le dire')} hitSlop={8}>
            <Text style={styles.skipLink}>Passer</Text>
          </Pressable>
        </View>
      </>
    );
  }

  if (step.kind === 'choice') {
    return (
      <>
        <Row>
          {step.options.map((option) => (
            <Chip key={option.label} label={option.label} onPress={() => onAnswer(option.value, option.label)} />
          ))}
        </Row>
        {step.optional && (
          <Pressable onPress={() => onAnswer(null, 'Je préfère ne pas le dire')} hitSlop={8}>
            <Text style={styles.skipLink}>Passer</Text>
          </Pressable>
        )}
      </>
    );
  }

  if (step.kind === 'days') {
    const days = WEEK_ORDER.filter((day) => multi.includes(day));
    return (
      <>
        <Row>
          {WEEK_ORDER.map((day) => (
            <Chip key={day} label={DAY_SHORT[day]} selected={multi.includes(day)} onPress={() => toggle(day)} />
          ))}
        </Row>
        <Button
          label={days.length ? `Valider (${days.length} par semaine)` : 'Choisis au moins un jour'}
          disabled={days.length === 0}
          onPress={() => onAnswer(days, days.map((day) => DAY_SHORT[day]).join(', '))}
        />
      </>
    );
  }

  if (step.kind === 'consent') {
    return (
      <>
        <Checkbox
          checked={healthData}
          onPress={() => setHealthData(!healthData)}
          label="J'accepte qu'Aria enregistre mes réponses de santé (douleurs, mensurations) sur ce téléphone pour adapter mes séances. Obligatoire."
        />
        <Checkbox
          checked={analytics}
          onPress={() => setAnalytics(!analytics)}
          label="J'accepte l'envoi de statistiques d'usage anonymes pour améliorer l'appli. Facultatif."
        />
        <Link href="/privacy" style={styles.privacyLink}>
          Lire la politique de confidentialité
        </Link>
        <Button
          label="C'est parti !"
          disabled={!healthData}
          onPress={() => onConsent({ healthData, analytics, acceptedAt: new Date().toISOString() })}
        />
      </>
    );
  }

  const selectedLabels = step.options
    .filter((o) => multi.includes(o.value))
    .map((o) => o.label)
    .join(', ');
  return (
    <>
      <Row>
        {step.options.map((option) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={multi.includes(option.value)}
            onPress={() => toggle(option.value)}
          />
        ))}
      </Row>
      <Button
        label={multi.length ? 'Valider' : step.noneLabel}
        onPress={() => onAnswer(multi, multi.length ? selectedLabels : step.noneLabel)}
      />
    </>
  );
}

function Checkbox({ checked, label, onPress }: { checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={styles.checkRow}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

type Snapshot = { stepIndex: number; answers: Answers; messages: Message[] };

const FIRST_MESSAGES: Message[] = [{ from: 'coach', text: STEPS[0].question({}) }];

export default function Onboarding() {
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const scrollRef = useRef<ScrollView>(null);

  const [started, setStarted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [messages, setMessages] = useState<Message[]>(FIRST_MESSAGES);
  // Une photo de la conversation avant chaque réponse, pour pouvoir revenir en arrière.
  const [past, setPast] = useState<Snapshot[]>([]);

  const step: Step | undefined = STEPS[stepIndex];

  const finish = (profile: Profile, consent: Consent, safetyFlags: string[]) => {
    completeOnboarding(profile, consent, safetyFlags);
    router.replace('/(tabs)');
    if (profile.reminderEnabled) {
      syncReminders(profile).then((allowed) => {
        if (!allowed) updateProfile({ ...profile, reminderEnabled: false });
      });
    }
  };

  const answer: Answer = (value, label) => {
    const current = STEPS[stepIndex];
    const next = { ...answers, [current.key]: value };
    const index = nextIndex(stepIndex, next);
    const nextMessages: Message[] = [...messages, { from: 'user', text: label }];
    const extra = current.after?.(next);
    if (extra) nextMessages.push({ from: 'coach', text: extra });
    if (index < STEPS.length) nextMessages.push({ from: 'coach', text: STEPS[index].question(next) });
    setPast([...past, { stepIndex, answers, messages }]);
    setAnswers(next);
    setMessages(nextMessages);
    setStepIndex(index);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const back = () => {
    const previous = past[past.length - 1];
    if (!previous) {
      setStarted(false);
      return;
    }
    setPast(past.slice(0, -1));
    setStepIndex(previous.stepIndex);
    setAnswers(previous.answers);
    setMessages(previous.messages);
  };

  const consent = (value: Consent) =>
    finish(
      toProfile(answers),
      value,
      SAFETY_KEYS.filter((key) => answers[key] === true),
    );

  const skipForTests = () =>
    finish(TEST_PROFILE, { healthData: true, analytics: false, acceptedAt: new Date().toISOString() }, []);

  if (!started) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.brand}>Aria</Text>
          {/* Bouton temporaire pour les tests : il sera retiré avant la publication. */}
          <Pressable onPress={skipForTests} hitSlop={12}>
            <Text style={styles.skip}>Passer (test)</Text>
          </Pressable>
        </View>
        <View style={styles.welcome}>
          <Title>Le sport à la maison, à ton rythme.</Title>
          <Body muted>
            Des séances courtes, sans matériel, qui s&apos;adaptent à ton niveau, à ton temps et à
            tes douleurs.
          </Body>
          <View style={styles.points}>
            <Body>· Quelques questions, deux minutes à peine</Body>
            <Body>· Une première séance prête tout de suite</Body>
            <Body>· Tout reste sur ton téléphone, sans compte</Body>
          </View>
        </View>
        <View style={styles.inputArea}>
          <Button label="Commencer" onPress={() => setStarted(true)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Retour">
          <Text style={styles.back}>‹ Retour</Text>
        </Pressable>
        <Pressable onPress={skipForTests} hitSlop={12}>
          <Text style={styles.skip}>Passer (test)</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
          {messages.map((message, index) => (
            <View
              key={index}
              style={[styles.bubble, message.from === 'coach' ? styles.coach : styles.user]}>
              <Text style={[styles.bubbleText, message.from === 'user' && styles.userText]}>
                {message.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputArea}>
          {step && <StepInput key={stepIndex} step={step} onAnswer={answer} onConsent={consent} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  brand: { fontSize: 22, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  back: { fontSize: 16, color: Colors.text, fontWeight: '600' },
  skip: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  welcome: { flex: 1, justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  points: { gap: Spacing.xs, marginTop: Spacing.sm },
  messages: { padding: Spacing.md, gap: Spacing.sm },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: Radius.md },
  coach: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  user: { alignSelf: 'flex-end', backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 16, lineHeight: 22, color: Colors.text },
  userText: { color: Colors.white },
  inputArea: {
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hint: { fontSize: 14, color: Colors.textSecondary },
  hintError: { color: Colors.text, fontWeight: '600' },
  skipLink: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600', textDecorationLine: 'underline' },
  checkRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  box: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  check: { color: Colors.white, fontSize: 14, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.text },
  privacyLink: { fontSize: 14, color: Colors.text, fontWeight: '600', textDecorationLine: 'underline' },
});
