import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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

import { Button, Chip, IconTile, type IconName, ProgressBar, Row } from '@/components/ui';
import { Colors, Fonts, Radius, Shadow, Spacing } from '@/constants/theme';
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
        {checked && <Ionicons name="checkmark" size={16} color={Colors.accent} />}
      </View>
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

type Snapshot = { stepIndex: number; answers: Answers; messages: Message[] };

const WELCOME_POINTS: { icon: IconName; text: string }[] = [
  { icon: 'chatbubble-ellipses', text: 'Quelques questions, deux minutes à peine' },
  { icon: 'flash', text: 'Une première séance prête tout de suite' },
  { icon: 'lock-closed', text: 'Tout reste sur ton téléphone, sans compte' },
];

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
      <SafeAreaView style={[styles.screen, styles.dark]} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <Text style={styles.brand}>Aria</Text>
          </View>
          {/* Bouton temporaire pour les tests : il sera retiré avant la publication. */}
          <Pressable onPress={skipForTests} hitSlop={12}>
            <Text style={styles.skipDark}>Passer (test)</Text>
          </Pressable>
        </View>
        <View style={styles.welcome}>
          <Text style={styles.hero}>
            Le sport à la maison,{'\n'}
            <Text style={styles.heroAccent}>à ton rythme.</Text>
          </Text>
          <Text style={styles.heroBody}>
            Des séances courtes, sans matériel, qui s&apos;adaptent à ton niveau, à ton temps et à
            tes douleurs.
          </Text>
          <View style={styles.points}>
            {WELCOME_POINTS.map((point) => (
              <View key={point.text} style={styles.point}>
                <IconTile icon={point.icon} tint={Colors.inkSoft} color={Colors.accent} size={44} />
                <Text style={styles.pointText}>{point.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.welcomeFooter}>
          <Button label="Commencer" icon="arrow-forward" variant="accent" onPress={() => setStarted(true)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable
          onPress={back}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </Pressable>
        <View style={styles.progress}>
          <ProgressBar value={step ? stepIndex / STEPS.length : 1} color={Colors.ink} height={6} />
        </View>
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
          {messages.map((message, index) => {
            const firstOfGroup = index === 0 || messages[index - 1].from !== message.from;
            if (message.from === 'user') {
              return (
                <View key={index} style={[styles.bubble, styles.user]}>
                  <Text style={[styles.bubbleText, styles.userText]}>{message.text}</Text>
                </View>
              );
            }
            return (
              <View key={index} style={styles.coachRow}>
                {firstOfGroup ? (
                  <View style={styles.coachAvatar}>
                    <Text style={styles.coachAvatarText}>A</Text>
                  </View>
                ) : (
                  <View style={styles.coachAvatarSpacer} />
                )}
                <View style={[styles.bubble, styles.coach]}>
                  <Text style={styles.bubbleText}>{message.text}</Text>
                </View>
              </View>
            );
          })}
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
  dark: { backgroundColor: Colors.ink },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  brandDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.accent },
  brand: { fontSize: 22, fontFamily: Fonts.extrabold, color: Colors.white, letterSpacing: -0.5 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow,
  },
  progress: { flex: 1 },
  skip: { fontSize: 14, color: Colors.textSecondary, fontFamily: Fonts.semibold },
  skipDark: { fontSize: 14, color: Colors.textOnDarkMuted, fontFamily: Fonts.semibold },
  welcome: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.md },
  hero: { fontSize: 40, lineHeight: 46, fontFamily: Fonts.extrabold, color: Colors.white, letterSpacing: -1.2 },
  heroAccent: { color: Colors.accent },
  heroBody: { fontSize: 17, lineHeight: 25, fontFamily: Fonts.regular, color: Colors.textOnDarkMuted },
  points: { gap: Spacing.md, marginTop: Spacing.lg },
  point: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pointText: { flex: 1, fontSize: 16, lineHeight: 22, fontFamily: Fonts.semibold, color: Colors.white },
  welcomeFooter: { padding: Spacing.lg },
  messages: { padding: Spacing.md, gap: Spacing.sm },
  coachRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachAvatarText: { fontSize: 14, fontFamily: Fonts.extrabold, color: Colors.accent },
  coachAvatarSpacer: { width: 32 },
  bubble: { maxWidth: '82%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20 },
  coach: { backgroundColor: Colors.card, borderTopLeftRadius: 6, ...Shadow },
  user: { alignSelf: 'flex-end', backgroundColor: Colors.ink, borderBottomRightRadius: 6 },
  bubbleText: { fontSize: 16, lineHeight: 23, fontFamily: Fonts.regular, color: Colors.text },
  userText: { color: Colors.white, fontFamily: Fonts.medium },
  inputArea: {
    padding: Spacing.md,
    gap: Spacing.sm + 2,
    backgroundColor: Colors.card,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    boxShadow: '0px -6px 24px rgba(14, 15, 18, 0.06)',
  },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hint: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textSecondary },
  hintError: { color: Colors.coral, fontFamily: Fonts.bold },
  skipLink: { fontSize: 14, color: Colors.textSecondary, fontFamily: Fonts.semibold, textDecorationLine: 'underline' },
  checkRow: { flexDirection: 'row', gap: Spacing.sm + 2, alignItems: 'flex-start' },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20, fontFamily: Fonts.regular, color: Colors.text },
  privacyLink: { fontSize: 14, color: Colors.text, fontFamily: Fonts.bold, textDecorationLine: 'underline' },
});
