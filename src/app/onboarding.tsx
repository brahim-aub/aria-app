import { useRouter } from 'expo-router';
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

import { Button, Chip, Row } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Profile } from '@/lib/types';
import { TEST_PROFILE, useAppStore } from '@/store/app-store';

type Option = { label: string; value: string | number };

type Step =
  | { key: 'firstName'; kind: 'text'; question: (p: Partial<Profile>) => string }
  | {
      key: 'age' | 'heightCm' | 'weightKg';
      kind: 'number';
      question: (p: Partial<Profile>) => string;
      unit: string;
      min: number;
      max: number;
    }
  | {
      key: 'goal' | 'level' | 'sex' | 'minutesPerSession' | 'daysPerWeek';
      kind: 'choice';
      question: (p: Partial<Profile>) => string;
      options: Option[];
    }
  | {
      key: 'equipment' | 'painZones';
      kind: 'multi';
      question: (p: Partial<Profile>) => string;
      options: Option[];
      noneLabel: string;
    };

/**
 * Onboarding scénarisé, présenté comme une conversation avec le coach.
 * Quand le fournisseur d'IA sera choisi, le coach pourra reformuler et relancer librement.
 */
const STEPS: Step[] = [
  {
    key: 'firstName',
    kind: 'text',
    question: () =>
      'Salut ! Moi c\'est Aria, ton coach. On va construire ensemble des séances faites pour toi, à ton rythme. Comment tu t\'appelles ?',
  },
  {
    key: 'goal',
    kind: 'choice',
    question: (p) => `Enchanté ${p.firstName} ! Qu'est-ce qui te motive à te lancer ?`,
    options: [
      { label: 'Perdre du poids', value: 'perte_poids' },
      { label: 'Prendre du muscle', value: 'muscle' },
      { label: 'Être en forme', value: 'forme' },
      { label: 'Gagner en souplesse', value: 'souplesse' },
      { label: 'Me remettre au sport', value: 'reprise' },
    ],
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
    key: 'sex',
    kind: 'choice',
    question: () =>
      'Pour calculer tes besoins en calories, j\'ai besoin de quelques infos. Tu es…',
    options: [
      { label: 'Un homme', value: 'homme' },
      { label: 'Une femme', value: 'femme' },
    ],
  },
  { key: 'age', kind: 'number', question: () => 'Quel âge as-tu ?', unit: 'ans', min: 16, max: 99 },
  {
    key: 'heightCm',
    kind: 'number',
    question: () => 'Combien tu mesures ?',
    unit: 'cm',
    min: 120,
    max: 230,
  },
  {
    key: 'weightKg',
    kind: 'number',
    question: () => 'Et ton poids ? Ça reste entre nous.',
    unit: 'kg',
    min: 30,
    max: 250,
  },
  {
    key: 'equipment',
    kind: 'multi',
    question: () => 'Tu as du matériel chez toi ? Tu peux en choisir plusieurs.',
    options: [
      { label: 'Un tapis', value: 'tapis' },
      { label: 'Un élastique', value: 'elastique' },
      { label: 'Des haltères', value: 'halteres' },
    ],
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
  },
  {
    key: 'minutesPerSession',
    kind: 'choice',
    question: () => 'Combien de temps tu peux y consacrer par séance ?',
    options: [
      { label: '10 min', value: 10 },
      { label: '20 min', value: 20 },
      { label: '30 min', value: 30 },
      { label: '45 min', value: 45 },
    ],
  },
  {
    key: 'daysPerWeek',
    kind: 'choice',
    question: () => 'Dernière question : combien de séances par semaine ?',
    options: [
      { label: '2', value: 2 },
      { label: '3', value: 3 },
      { label: '4', value: 4 },
      { label: '5', value: 5 },
    ],
  },
];

type Message = { from: 'coach' | 'user'; text: string };

export default function Onboarding() {
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const scrollRef = useRef<ScrollView>(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Partial<Profile>>({});
  const [messages, setMessages] = useState<Message[]>([
    { from: 'coach', text: STEPS[0].question({}) },
  ]);
  const [text, setText] = useState('');
  const [multi, setMulti] = useState<string[]>([]);

  const step = STEPS[stepIndex];
  const done = stepIndex >= STEPS.length;

  const finish = (profile: Profile) => {
    completeOnboarding(profile);
    router.replace('/(tabs)');
  };

  const answer = (value: Profile[keyof Profile], label: string) => {
    const next = { ...answers, [step.key]: value };
    const nextIndex = stepIndex + 1;
    const nextMessages: Message[] = [...messages, { from: 'user', text: label }];
    if (nextIndex < STEPS.length) {
      nextMessages.push({ from: 'coach', text: STEPS[nextIndex].question(next) });
    } else {
      nextMessages.push({
        from: 'coach',
        text: `Parfait ${next.firstName}, j'ai tout ce qu'il me faut. Ta première séance est prête !`,
      });
    }
    setAnswers(next);
    setMessages(nextMessages);
    setStepIndex(nextIndex);
    setText('');
    setMulti([]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const numberValue = Number(text.replace(',', '.'));
  const numberValid =
    step?.kind === 'number' &&
    text.trim() !== '' &&
    Number.isFinite(numberValue) &&
    numberValue >= step.min &&
    numberValue <= step.max;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.brand}>Aria</Text>
        {/* Bouton temporaire pour les tests : il sera retiré avant la publication. */}
        <Pressable onPress={() => finish(TEST_PROFILE)} hitSlop={12}>
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
          {done && (
            <Button
              label="C'est parti !"
              onPress={() => finish({ ...TEST_PROFILE, ...answers } as Profile)}
            />
          )}

          {step?.kind === 'text' && (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Ton prénom"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={() => text.trim() && answer(text.trim(), text.trim())}
              />
              <Button
                label="OK"
                disabled={!text.trim()}
                onPress={() => answer(text.trim(), text.trim())}
              />
            </View>
          )}

          {step?.kind === 'number' && (
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
                disabled={!numberValid}
                onPress={() => answer(Math.round(numberValue), `${text} ${step.unit}`)}
              />
            </View>
          )}

          {step?.kind === 'choice' && (
            <Row>
              {step.options.map((option) => (
                <Chip
                  key={option.label}
                  label={option.label}
                  onPress={() => answer(option.value as Profile[keyof Profile], option.label)}
                />
              ))}
            </Row>
          )}

          {step?.kind === 'multi' && (
            <>
              <Row>
                {step.options.map((option) => {
                  const value = String(option.value);
                  const selected = multi.includes(value);
                  return (
                    <Chip
                      key={value}
                      label={option.label}
                      selected={selected}
                      onPress={() =>
                        setMulti(selected ? multi.filter((v) => v !== value) : [...multi, value])
                      }
                    />
                  );
                })}
              </Row>
              <Button
                label={multi.length ? 'Valider' : step.noneLabel}
                onPress={() =>
                  answer(
                    multi as Profile[keyof Profile],
                    multi.length
                      ? step.options
                          .filter((o) => multi.includes(String(o.value)))
                          .map((o) => o.label)
                          .join(', ')
                      : step.noneLabel,
                  )
                }
              />
            </>
          )}
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
  brand: { fontSize: 24, fontWeight: '900', color: Colors.primary },
  skip: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600' },
  messages: { padding: Spacing.md, gap: Spacing.sm },
  bubble: { maxWidth: '85%', padding: 14, borderRadius: Radius.md },
  coach: { alignSelf: 'flex-start', backgroundColor: Colors.card, borderBottomLeftRadius: 4 },
  user: { alignSelf: 'flex-end', backgroundColor: Colors.secondary, borderBottomRightRadius: 4 },
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
});
