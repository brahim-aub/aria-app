import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Pressable, ScrollView, ScrollViewInstance, StyleSheet, Text, TextInput, TextInputInstance, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card, IconButton, Muted } from '@/components/ui';
import { applyActions, askCoach, editMealPlan, generateMealPlan } from '@/lib/coach';
import { confirmAction } from '@/lib/confirm';
import { focusRing, PressState, pressFeedback } from '@/lib/motion';
import { energyTargets, projectWeight } from '@/lib/nutrition';
import { euro, priceHints, storeTotals } from '@/lib/prices';
import { newId } from '@/lib/workout';
import { snapshot, useApp } from '@/store/AppStore';
import { AI_CONSENT_TEXT } from '@/lib/consent';
import { getCoachUndoPatch } from '@/lib/coachUndo';
import { useAuth } from '@/store/AuthStore';
import type { ChatMessage } from '@/store/types';
import { colors, radius, spacing, font } from '@/theme';

const STARTERS = [
  "J'ai que 15 minutes aujourd'hui",
  "Pas de matériel aujourd'hui",
  "J'ai mal au poignet depuis hier",
  'Décale ma séance à demain',
  'Aide-moi pour mon alimentation',
  'Explique-moi ma séance du jour',
];

export default function Coach() {
  const { data, apiKey, ai, setHealthConsent, addMessage, patchMessage, mutate, undoMessage, clearChat, setMealPlan, findPrices } = useApp();
  const auth = useAuth();
  const params = useLocalSearchParams<{ prompt?: string; intent?: string }>();
  const consent = !!data.healthConsentAt;
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const inputRef = useRef<TextInputInstance>(null);
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

  const runPriceSearch = useCallback(async () => {
    const stores = dataRef.current.nutrition.prefs.stores ?? [];
    const id = addMessage({
      role: 'model',
      text: stores.length
        ? `Je cherche les prix réels en ligne chez ${stores.join(', ')}… ça peut prendre une minute 🛒`
        : 'Je cherche les prix réels en ligne…',
      pending: true,
    });
    scrollToEnd();
    try {
      await findPrices();
      await new Promise((r) => setTimeout(r, 50));
      const check = dataRef.current.nutrition.priceCheck;
      const totals = check ? storeTotals(check) : [];
      patchMessage(id, {
        pending: false,
        text: totals.length
          ? `Voici le ticket de caisse de la semaine (prix trouvés en ligne) :\n${totals.map((t) => `- **${t.store}** : ${euro(t.basket)} (${t.found}/${t.total} produits trouvés)`).join('\n')}`
          : 'Je n’ai trouvé aucun prix fiable en ligne pour ces magasins.',
        changes: totals.length ? ['Prix réels des magasins enregistrés'] : undefined,
        link: 'nutrition',
      });
    } catch (e) {
      patchMessage(id, { pending: false, error: true, text: (e as Error).message });
    }
    scrollToEnd();
  }, [addMessage, findPrices, patchMessage]);

  const runMealPlan = useCallback(
    async (instructions: string, withPrices = false) => {
      const id = addMessage({ role: 'model', text: 'Je prépare ton plan de repas sur 7 jours… ça prend environ 30 secondes 🍽️', pending: true });
      scrollToEnd();
      try {
        await new Promise((r) => setTimeout(r, 50));
        const check = dataRef.current.nutrition.priceCheck;
        const plan = await generateMealPlan(dataRef.current, ai, instructions, withPrices ? priceHints(check, check?.selectedStore) : '');
        setMealPlan(plan);
        patchMessage(id, {
          pending: false,
          text: `Ton plan de repas est prêt : ${plan.targetKcal} kcal/jour en moyenne, ${plan.proteinG} g de protéines. Tu le retrouves dans l’onglet Nutrition, avec la liste de courses.`,
          changes: ['Plan de repas sur 7 jours créé'],
          link: 'nutrition',
        });
        return true;
      } catch (e) {
        patchMessage(id, { pending: false, error: true, text: `Je n’ai pas réussi à créer le plan de repas. ${(e as Error).message}` });
        return false;
      } finally {
        scrollToEnd();
      }
    },
    [addMessage, ai, patchMessage, setMealPlan],
  );

  /** Modifie le plan existant (un aliment, un repas) sans le refaire. */
  const runMealEdit = useCallback(
    async (instruction: string) => {
      const id = addMessage({ role: 'model', text: 'Je modifie tes menus, le reste ne bouge pas… ✏️', pending: true });
      scrollToEnd();
      try {
        await new Promise((r) => setTimeout(r, 50));
        const { plan: before, priceCheck } = dataRef.current.nutrition;
        const hadPrices = !!before && priceCheck?.planCreatedAt === before.createdAt;
        const { plan, changed } = await editMealPlan(dataRef.current, ai, instruction);
        mutate((d) => ({ ...d, nutrition: { ...d.nutrition, plan } }));
        patchMessage(id, {
          pending: false,
          text: `C’est modifié : ${changed} repas changé${changed > 1 ? 's' : ''}, le reste de ton plan est identique.`,
          changes: ['Plan de repas ajusté'],
          link: 'nutrition',
        });
        return hadPrices;
      } catch (e) {
        patchMessage(id, { pending: false, error: true, text: `Je n’ai pas réussi à modifier tes menus. ${(e as Error).message}` });
        return false;
      } finally {
        scrollToEnd();
      }
    },
    [addMessage, ai, mutate, patchMessage],
  );

  /** Menus moins chers : on refait le plan à partir des prix déjà relevés, puis on recherche les prix. */
  const runCheaper = useCallback(
    async (budget: number) => {
      setBusy(true);
      try {
        const check = dataRef.current.nutrition.priceCheck;
        const total = check ? storeTotals(check).find((t) => t.store === check.selectedStore) : undefined;
        const why = total ? `Les menus actuels coûtent environ ${euro(total.portions)} de nourriture mangée dans la semaine. ` : '';
        const ok = await runMealPlan(`${why}Refais les menus pour que la nourriture consommée sur la semaine coûte au plus ${budget} €. Remplace les postes les plus chers par des alternatives économiques (légumineuses, œufs, riz, pâtes, légumes de saison, morceaux peu chers), en gardant les kcal et protéines cibles.`, true);
        if (!ok) return;
        await new Promise((r) => setTimeout(r, 50));
        await runPriceSearch();
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [runMealPlan, runPriceSearch],
  );

  const run = useCallback(
    async (text: string) => {
      setBusy(true);
      scrollToEnd();
      try {
        // Laisse le message utilisateur s'enregistrer avant de lire l'état.
        await new Promise((r) => setTimeout(r, 30));
        const res = await askCoach(dataRef.current, ai, text);
        const msgId = newId();
        mutate((d) => {
          const applied = applyActions(d, res.actions);
          const msg: ChatMessage = {
            id: msgId,
            role: 'model',
            text: res.reply || (applied.changes.length ? 'C’est fait !' : 'Je n’ai pas bien compris, tu peux reformuler ?'),
            date: new Date().toISOString(),
            quickReplies: res.quickReplies,
            changes: applied.changes.length ? applied.changes : undefined,
            undo: applied.changes.length ? snapshot(d) : undefined,
            undoAfter: applied.changes.length ? snapshot(applied.data) : undefined,
            link: applied.changes.length ? (applied.nutritionOnly ? 'nutrition' : 'programme') : undefined,
          };
          return {
            ...applied.data,
            chat: [...d.chat.map((m) => (m.undo ? { ...m, undo: undefined, undoAfter: undefined } : m)), msg].slice(-200),
            counters: { ...applied.data.counters, aiAdaptations: applied.data.counters.aiAdaptations + applied.adaptations },
          };
        });
        const proj = res.actions.find((a) => a.type === 'project_weight');
        if (proj) {
          const d = dataRef.current;
          const plan = d.nutrition.plan;
          const avg = plan?.days.length ? Math.round(plan.days.reduce((s, x) => s + x.kcal, 0) / plan.days.length) : energyTargets(d).target;
          const kcal = proj.kcal && proj.kcal >= 500 ? Math.min(6000, proj.kcal) : avg;
          const weeks = Math.min(26, Math.max(1, Math.round(proj.weeks || 4)));
          const pr = projectWeight(d, kcal, weeks);
          const kg = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
          addMessage({
            role: 'model',
            text: `Projection sur ${weeks} semaine${weeks > 1 ? 's' : ''} à ${kcal} kcal par jour (ton corps en dépense environ ${pr.maintenance}) : ${kg(d.profile.weightKg)} → **${kg(pr.endKg)} kg**, fourchette ${kg(Math.min(pr.lowKg, pr.highKg))} à ${kg(Math.max(pr.lowKg, pr.highKg))} kg, soit ${Math.abs(pr.perWeekKg).toLocaleString('fr-FR')} kg ${pr.perWeekKg < 0 ? 'perdus' : 'pris'} par semaine. C’est une estimation, pas une promesse.${pr.warning ? '\n⚠️ ' + pr.warning : ''}`,
          });
        }
        const edit = res.actions.find((a) => a.type === 'edit_meal_plan');
        const meal = res.actions.find((a) => a.type === 'generate_meal_plan');
        let repriced = false;
        if (edit) {
          await new Promise((r) => setTimeout(r, 50));
          const hadPrices = await runMealEdit(edit.mealInstructions || text);
          if (hadPrices && !res.actions.some((a) => a.type === 'search_prices')) {
            await runPriceSearch();
            repriced = true;
          }
        } else if (meal) {
          await new Promise((r) => setTimeout(r, 50));
          await runMealPlan(meal.mealInstructions ?? '', !!dataRef.current.nutrition.priceCheck);
        }
        if (!repriced && res.actions.some((a) => a.type === 'search_prices')) {
          await new Promise((r) => setTimeout(r, 50));
          await runPriceSearch();
        }
      } catch (e) {
        addMessage({ role: 'model', text: (e as Error).message, error: true });
      } finally {
        setBusy(false);
        scrollToEnd();
      }
    },
    [addMessage, ai, mutate, runMealEdit, runMealPlan, runPriceSearch],
  );

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      // Sans accord, rien ne part chez Google : le message attend dans le champ.
      if (!consent) {
        setInput(text);
        return;
      }
      setInput('');
      addMessage({ role: 'user', text });
      run(text);
    },
    [addMessage, busy, run, consent],
  );

  // Message prérempli depuis l'accueil ou le programme.
  useEffect(() => {
    const prompt = params.prompt;
    if (!prompt) return;
    router.setParams({ prompt: undefined, intent: undefined });
    if (params.intent === 'cheaper' && dataRef.current.healthConsentAt) {
      // Action décidée par l'app, pas par le modèle : on ne le laisse pas promettre sans agir.
      const budget = dataRef.current.nutrition.prefs.weeklyBudget;
      if (budget) {
        addMessage({ role: 'user', text: prompt });
        runCheaper(budget);
        return;
      }
    }
    if (prompt.trim().endsWith(':')) {
      // Le paramètre de navigation est une source externe : on le recopie dans le champ.
      setInput(prompt);
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      send(prompt);
    }
  }, [params.prompt, params.intent, send, addMessage, runCheaper]);

  const lastUser = [...data.chat].reverse().find((m) => m.role === 'user');
  const last = data.chat[data.chat.length - 1];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="sparkles" size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} role="heading" aria-level={1}>
            Coach Aria
          </Text>
          <Text style={styles.subtitle} accessibilityLiveRegion="polite">
            {busy ? 'Réfléchit…' : 'Adapte ton programme en un message'}
          </Text>
        </View>
        {data.chat.length > 0 && (
          <IconButton
            icon="trash-outline"
            label="Effacer la conversation"
            color={colors.muted}
            onPress={async () => {
              if (await confirmAction('Effacer la conversation ?', 'Tes séances et réglages ne changent pas.', 'Effacer', true)) clearChat();
            }}
          />
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.list} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled">
          {!consent && (
            <Card>
              <Text style={styles.cardTitle}>Avant de discuter avec le coach</Text>
              <Muted>{AI_CONSENT_TEXT}</Muted>
              <Button title="J’accepte" icon="checkmark" onPress={() => setHealthConsent(true)} />
              <Pressable onPress={() => router.push('/confidentialite')} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>Lire la politique de confidentialité</Text>
              </Pressable>
            </Card>
          )}

          {!apiKey && !auth.session && (
            <Card style={{ borderColor: colors.rest }}>
              <Text style={styles.warnTitle}>Clé API Gemini manquante</Text>
              <Muted>Ajoute ta clé Google AI Studio dans Réglages pour activer le coach.</Muted>
              <Pressable onPress={() => router.push('/reglages')} accessibilityRole="link" hitSlop={8}>
                <Text style={styles.link}>Ouvrir les réglages</Text>
              </Pressable>
            </Card>
          )}

          {data.chat.length === 0 && (
            <View style={styles.welcome}>
              <Bubble
                msg={{
                  id: 'welcome',
                  role: 'model',
                  date: '',
                  text: `Salut${data.profile.name ? ` ${data.profile.name}` : ''} ! Je suis Aria, ton coach. Je connais ton programme et je peux le modifier pour toi.\n\nUn imprévu, une douleur, pas de matériel, peu de temps, une question sur ton alimentation ? Écris-le simplement, je m’occupe du reste.`,
                }}
              />
              <View style={styles.starters}>
                {STARTERS.map((s) => (
                  <Pressable key={s} accessibilityRole="button" style={(st: PressState) => [styles.starter, st.hovered && { borderColor: colors.borderStrong }, pressFeedback(st, 0.96), focusRing(st, radius.pill)]} onPress={() => send(s)}>
                    <Text style={styles.starterText}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {data.chat.map((m) => (
            <View key={m.id} style={{ gap: spacing.sm }}>
              <Bubble
                msg={m}
                onUndo={() => undoMessage(m.id)}
                undoDisabledReason={m.undo && !getCoachUndoPatch(data, m)
                  ? m.undoAfter
                    ? 'Annulation indisponible : les données concernées ont changé depuis cette action.'
                    : 'Cette ancienne modification ne peut plus être annulée en toute sécurité.'
                  : undefined}
                onRetry={m.error && lastUser && m === last ? () => run(lastUser.text) : undefined}
              />
              {m === last && m.role === 'model' && !busy && m.quickReplies?.length ? (
                <View style={styles.starters}>
                  {m.quickReplies.map((q) => (
                    <Pressable key={q} accessibilityRole="button" style={(st: PressState) => [styles.starter, st.hovered && { borderColor: colors.borderStrong }, pressFeedback(st, 0.96), focusRing(st, radius.pill)]} onPress={() => send(q)}>
                      <Text style={styles.starterText}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
          {busy && <Typing />}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            placeholder="Écris à ton coach…"
            accessibilityLabel="Message au coach"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
            maxLength={1000}
          />
          <Pressable
            onPress={() => send(input)}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
            accessibilityState={{ disabled: !input.trim() || busy, busy }}
            style={(st: PressState) => [styles.sendBtn, { opacity: !input.trim() || busy ? 0.4 : 1 }, pressFeedback(st, 0.94), focusRing(st, 22)]}
          >
            {busy ? <ActivityIndicator color={colors.onDark} size="small" /> : <Ionicons name="arrow-up" size={22} color={colors.accent} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ msg, onUndo, onRetry, undoDisabledReason }: { msg: ChatMessage; onUndo?: () => void; onRetry?: () => void; undoDisabledReason?: string }) {
  const mine = msg.role === 'user';
  return (
    <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, msg.error && { borderColor: colors.danger }]}>
        {msg.pending && <ActivityIndicator color={colors.muted} size="small" style={{ alignSelf: 'flex-start' }} />}
        <RichText text={msg.text} color={mine ? colors.onDark : colors.text} />
        {msg.changes?.length ? (
          <View style={styles.changes}>
            {msg.changes.map((c, i) => (
              <View key={i} style={styles.changeRow}>
                <Ionicons name="checkmark-circle" size={16} color={colors.accentInk} />
                <Text style={styles.changeText}>{c}</Text>
              </View>
            ))}
            <View style={styles.changeActions}>
              {msg.link && (
                <Pressable onPress={() => router.navigate(msg.link === 'nutrition' ? '/nutrition' : '/programme')}>
                  <Text style={styles.link}>{msg.link === 'nutrition' ? 'Voir mes repas' : 'Voir le programme'}</Text>
                </Pressable>
              )}
              {msg.undo && onUndo && (
                <Pressable
                  onPress={onUndo}
                  disabled={!!undoDisabledReason}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!undoDisabledReason }}
                  accessibilityHint={undoDisabledReason}
                  style={{ minHeight: 44, justifyContent: 'center', opacity: undoDisabledReason ? 0.5 : 1 }}
                >
                  <Text style={[styles.link, { color: colors.muted }]}>Annuler</Text>
                </Pressable>
              )}
            </View>
            {msg.undo && undoDisabledReason && (
              <Text style={{ color: colors.muted, fontFamily: font.regular, fontSize: 12, lineHeight: 18 }} accessibilityLiveRegion="polite">
                {undoDisabledReason}
              </Text>
            )}
          </View>
        ) : null}
        {onRetry && (
          <Pressable onPress={onRetry} style={styles.retry}>
            <Ionicons name="refresh" size={16} color={colors.accentInk} />
            <Text style={styles.link}>Réessayer</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Rendu léger du markdown : **gras** et listes à puces. */
function RichText({ text, color }: { text: string; color: string }) {
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, i) => {
        const bullet = /^\s*([-*•]|\d+\.)\s+/.exec(line);
        const content = bullet ? line.slice(bullet[0].length) : line;
        if (!content.trim()) return <View key={i} style={{ height: 4 }} />;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const body = (
          <Text style={[styles.msgText, { color }, bullet && { flex: 1 }]}>
            {parts.map((p, k) =>
              p.startsWith('**') && p.endsWith('**') ? (
                <Text key={k} style={{ fontFamily: font.black }}>
                  {p.slice(2, -2)}
                </Text>
              ) : (
                p
              ),
            )}
          </Text>
        );
        return bullet ? (
          <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={[styles.msgText, { color: colors.muted }]}>{/\d/.test(bullet[1]) ? bullet[1] : '•'}</Text>
            {body}
          </View>
        ) : (
          <View key={i}>{body}</View>
        );
      })}
    </View>
  );
}

function Typing() {
  const [dots] = useState(() => [new Animated.Value(0.3), new Animated.Value(0.3), new Animated.Value(0.3)]);
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(d, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View style={styles.bubbleRow}>
      <View style={[styles.bubble, styles.theirs, { flexDirection: 'row', gap: 6, paddingVertical: 16 }]}>
        {dots.map((d, i) => (
          <Animated.View key={i} style={[styles.typingDot, { opacity: d }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
  title: { color: colors.text, fontFamily: font.black, fontSize: 18 },
  subtitle: { fontFamily: font.regular, color: colors.muted, fontSize: 13 },
  list: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.lg },
  warnTitle: { color: colors.rest, fontFamily: font.black, fontSize: 16 },
  cardTitle: { color: colors.text, fontFamily: font.black, fontSize: 16 },
  welcome: { gap: spacing.md },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  starter: { minHeight: 40, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  starterText: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { maxWidth: '88%', borderRadius: 20, padding: spacing.md, gap: spacing.sm, borderWidth: 1 },
  mine: { backgroundColor: colors.dark, borderColor: colors.dark, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.card, borderColor: colors.border, borderBottomLeftRadius: 6 },
  msgText: { fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  changes: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.sm + 2, gap: 6 },
  changeRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  changeText: { color: colors.text, fontSize: 13, fontFamily: font.bold, flex: 1 },
  changeActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  link: { color: colors.accentInk, fontFamily: font.black, fontSize: 13 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.sm, paddingHorizontal: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { fontFamily: font.regular, flex: 1, color: colors.text, backgroundColor: colors.card, borderRadius: 22, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingTop: 11, paddingBottom: 11, fontSize: 15, maxHeight: 120 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark },
});
