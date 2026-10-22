import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Field } from '@/components/kit';
import { Button, Card, Chip, Muted, Screen } from '@/components/ui';
import { DIET_LABEL } from '@/lib/nutrition';
import { MAX_STORES, STORES } from '@/lib/prices';
import { useApp } from '@/store/AppStore';
import type { Diet, NutritionPrefs } from '@/store/types';
import { colors, font, spacing } from '@/theme';

const COOKING = { rapide: 'Rapide (< 15 min)', moyen: 'Moyen (15-30 min)', long: 'J’aime cuisiner' } as const;
const BUDGET = { serre: 'Serré', moyen: 'Moyen', large: 'Large' } as const;

export default function PreferencesRepas() {
  const { data, setNutritionPrefs } = useApp();
  const [p, setP] = useState<NutritionPrefs>(data.nutrition.prefs);
  const set = (patch: Partial<NutritionPrefs>) => setP((cur) => ({ ...cur, ...patch }));
  const [budgetText, setBudgetText] = useState(p.weeklyBudget ? String(p.weeklyBudget) : '');
  const [otherStore, setOtherStore] = useState('');
  const stores = p.stores ?? [];
  const toggleStore = (name: string) =>
    set({ stores: stores.includes(name) ? stores.filter((x) => x !== name) : stores.length >= MAX_STORES ? stores : [...stores, name] });
  const allStores = [...STORES, ...stores.filter((x) => !STORES.includes(x))];

  return (
    <Screen top={false}>
      <Muted>Plus tu es précis, plus les menus te ressembleront. Tu peux aussi tout dire directement au coach.</Muted>

      <Card>
      <Text style={styles.section} role="heading" aria-level={2}>
        Ce que tu manges
      </Text>
      <Text style={styles.label}>Régime</Text>
      <View style={styles.chips}>
        {(Object.keys(DIET_LABEL) as Diet[]).map((d) => (
          <Chip key={d} label={DIET_LABEL[d]} active={p.diet === d} onPress={() => set({ diet: d })} />
        ))}
      </View>

      <Field label="Ce que tu aimes" value={p.likes} onChangeText={(likes) => set({ likes })} placeholder="Ex : poulet, riz, pâtes, avocat, chocolat noir…" multiline />
      <Field label="Ce que tu n’aimes pas" value={p.dislikes} onChangeText={(dislikes) => set({ dislikes })} placeholder="Ex : brocoli, poisson, champignons…" multiline />
      <Field label="Allergies ou intolérances" value={p.allergies} onChangeText={(allergies) => set({ allergies })} placeholder="Ex : lactose, arachides…" hint="Laisse vide si tu n’en as pas." />

      </Card>

      <Card>
      <Text style={styles.section} role="heading" aria-level={2}>
        Ton organisation
      </Text>
      <Text style={styles.label}>Repas par jour (collations comprises)</Text>
      <View style={styles.chips}>
        {[2, 3, 4, 5].map((n) => (
          <Chip key={n} label={`${n}`} active={p.mealsPerDay === n} onPress={() => set({ mealsPerDay: n })} />
        ))}
      </View>

      <Text style={styles.label}>Temps de cuisine</Text>
      <View style={styles.chips}>
        {(Object.keys(COOKING) as (keyof typeof COOKING)[]).map((k) => (
          <Chip key={k} label={COOKING[k]} active={p.cookingTime === k} onPress={() => set({ cookingTime: k })} />
        ))}
      </View>

      <Text style={styles.label}>Budget courses</Text>
      <View style={styles.chips}>
        {(Object.keys(BUDGET) as (keyof typeof BUDGET)[]).map((k) => (
          <Chip key={k} label={BUDGET[k]} active={p.budget === k} onPress={() => set({ budget: k })} />
        ))}
      </View>

      </Card>

      <Card>
      <Text style={styles.section} role="heading" aria-level={2}>
        Tes courses
      </Text>
      <Text style={styles.label}>Mes magasins (jusqu’à {MAX_STORES})</Text>
      <View style={styles.chips}>
        {allStores.map((name) => (
          <Chip key={name} label={name} active={stores.includes(name)} onPress={() => toggleStore(name)} />
        ))}
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field value={otherStore} onChangeText={setOtherStore} placeholder="Autre magasin (ex. Cora)" accessibilityLabel="Autre magasin" />
        </View>
        <Button
          title="Ajouter"
          variant="secondary"
          disabled={!otherStore.trim() || stores.length >= MAX_STORES}
          onPress={() => {
            toggleStore(otherStore.trim());
            setOtherStore('');
          }}
        />
      </View>
      <Muted style={{ fontSize: 12 }}>
        Le coach donne le prix de tes ingrédients dans ces magasins. Ces prix sont indicatifs : un produit qu’il ne connaît pas reste sans prix.
      </Muted>

      <Field
        label="Budget courses max par semaine (€)"
        value={budgetText}
        onChangeText={setBudgetText}
        keyboardType="number-pad"
        placeholder="Ex : 60"
        hint="Laisse vide pour ne pas fixer de limite."
        maxLength={4}
      />
      </Card>

      <Button
        title="Enregistrer"
        icon="checkmark"
        big
        style={{ marginTop: spacing.sm }}
        onPress={() => {
          const budget = parseInt(budgetText, 10);
          setNutritionPrefs({
            ...p,
            likes: p.likes.trim(),
            dislikes: p.dislikes.trim(),
            allergies: p.allergies.trim(),
            weeklyBudget: Number.isFinite(budget) && budget > 0 ? budget : undefined,
          });
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontFamily: font.black, fontSize: 18 },
  label: { color: colors.text, fontFamily: font.bold, fontSize: 15, marginTop: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
