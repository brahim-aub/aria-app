import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { EditorialCard } from '@/components/brand';
import { askCoach } from '@/components/DayActions';
import { Panel, ProgressBar, SectionHeader, Tag } from '@/components/kit';
import { Button, Card, Chip, H1, IconName, Muted, Screen } from '@/components/ui';
import { GOAL_LABEL } from '@/data/generator';
import { generateMealPlan } from '@/lib/coach';
import { confirmAction, notify } from '@/lib/confirm';
import { ensureAiConsent } from '@/lib/consent';
import { formatDate } from '@/lib/date';
import { DIET_LABEL, energyTargets, projectWeight } from '@/lib/nutrition';
import { euro, gramsLabel, itemPrice, storeTotals } from '@/lib/prices';
import { productPageUrl } from '@/lib/productUrl';
import { useApp } from '@/store/AppStore';
import type { AppData, Meal, MealItem, PriceCheck } from '@/store/types';
import { colors, font, radius, spacing, type } from '@/theme';

const openUrl = (raw: string) => {
  const url = productPageUrl(raw);
  if (!url) {
    notify('Lien produit invalide', 'Cette adresse fournie avec le relevé est incorrecte. Relance la recherche des prix pour obtenir un nouveau lien.');
    return;
  }
  Linking.openURL(url).catch(() => notify('Lien inaccessible', 'Impossible d’ouvrir cette page. Réessaie plus tard.'));
};
/** Date du relevé en ligne, affichée à côté de chaque prix. */
const foundLabel = (iso: string) => ` · relevé le ${new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;

export default function Nutrition() {
  const { data, ai, setHealthConsent, setMealPlan, updateProfile, priceSearch, findPrices, selectStore } = useApp();
  const [loading, setLoading] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [showGroceries, setShowGroceries] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const t = energyTargets(data);
  const { prefs, prefsSet, plan } = data.nutrition;
  const p = data.profile;
  const stores = prefs.stores ?? [];
  // Les prix ne valent que pour le menu sur lequel ils ont été cherchés.
  const check = plan && data.nutrition.priceCheck?.planCreatedAt === plan.createdAt ? data.nutrition.priceCheck : undefined;
  const totals = check ? storeTotals(check) : [];
  const store = check?.selectedStore;
  const selectedTotal = totals.find((x) => x.store === store);
  const cheapest = totals.filter((x) => x.found === totals[0]?.found).sort((a, b) => a.basket - b.basket)[0];

  const generate = async () => {
    if (!prefsSet) {
      router.push('/preferences-repas');
      return;
    }
    if (!(await ensureAiConsent(data.healthConsentAt, setHealthConsent))) return;
    setLoading(true);
    try {
      const mp = await generateMealPlan(data, ai);
      setMealPlan(mp);
      setDayIndex(0);
    } catch (e) {
      notify('Menus non générés', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const searchRealPrices = async () => {
    if (!stores.length) {
      router.push('/preferences-repas');
      return;
    }
    if (!(await ensureAiConsent(data.healthConsentAt, setHealthConsent))) return;
    try {
      await findPrices();
    } catch (e) {
      notify('Prix introuvables', (e as Error).message);
    }
  };

  if (!p.wantsNutrition) {
    return (
      <Screen>
        <H1 style={{ marginTop: spacing.sm }}>Nutrition</H1>
        <Panel tone="surface">
          <View style={styles.offIcon}>
            <Ionicons name="restaurant-outline" size={26} color={colors.text} />
          </View>
          <Text style={styles.offTitle}>Besoin d’un coup de main pour manger ?</Text>
          <Muted>Tes besoins calculés selon tes séances et ton quotidien, et des menus construits avec les aliments que tu aimes.</Muted>
          <Button title="Activer l’aide nutrition" icon="checkmark" style={{ marginTop: spacing.sm }} onPress={() => updateProfile({ wantsNutrition: true })} />
        </Panel>
      </Screen>
    );
  }

  const di = Math.min(dayIndex, (plan?.days.length ?? 1) - 1);
  const day = plan?.days[di];
  const macros = [
    { label: 'Protéines', g: t.proteinG, kcal: t.proteinG * 4 },
    { label: 'Glucides', g: t.carbsG, kcal: t.carbsG * 4 },
    { label: 'Lipides', g: t.fatG, kcal: t.fatG * 9 },
  ];
  const budget = prefs.weeklyBudget;
  const dayCost = day ? costOf(day.meals.flatMap((m) => m.items), check, store) : undefined;

  return (
    <Screen>
      <H1 style={{ marginTop: spacing.sm }}>Nutrition</H1>
      {!plan && <EditorialCard image="nutrition" kicker="BIEN MANGER, SIMPLEMENT" title="Du bon dans ton quotidien." subtitle="Des repas à ton goût. Un budget qui te ressemble." />}
      <Muted>{plan ? 'Choisis un jour, puis un repas pour voir les quantités et la recette.' : 'Tes goûts sont le point de départ. Le coach s’occupe du menu.'}</Muted>

      <SectionHeader title="Mes menus" action={plan ? 'Ajuster avec le coach' : undefined} onAction={() => askCoach('Ajuste mon plan de repas : ')} />
      {loading ? (
        <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <ActivityIndicator color={colors.text} size="large" />
          <Text style={styles.cardTitle}>Le coach cuisine ton plan…</Text>
          <Muted>Environ 30 secondes.</Muted>
        </Card>
      ) : !plan ? (
        <Card>
          <Text style={styles.cardTitle}>Pas encore de plan de repas</Text>
          <Muted>7 jours de menus calés sur tes besoins, tes séances et tes goûts, puis le prix des courses dans tes magasins.</Muted>
          <Button title={prefsSet ? 'Générer mes menus' : 'Renseigner mes goûts'} icon="sparkles" onPress={generate} />
          <Button title="En parler au coach" icon="chatbubbles" variant="secondary" onPress={() => askCoach("J'aimerais de l'aide pour mon alimentation.")} />
        </Card>
      ) : (
        <>
          <Muted>
            Menus de la semaine · créés le {formatDate(plan.createdAt)}
          </Muted>

          <View style={styles.tags}>
            {plan.days.map((d, i) => (
              <Chip key={i} label={d.day.slice(0, 3)} active={i === di} onPress={() => setDayIndex(i)} />
            ))}
          </View>
          {day && (
            <>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>{day.day.charAt(0).toUpperCase() + day.day.slice(1)}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Tag label={`${day.kcal} kcal`} color={colors.pink} icon="flame" />
                  {dayCost && dayCost.found > 0 && <Tag label={euro(dayCost.cost)} color={colors.accentInk} icon="wallet" />}
                </View>
              </View>
              <Muted style={{ fontSize: 12 }}>Calories prévues dans ces menus, pas un suivi de ce que tu as mangé.</Muted>
              {dayCost && dayCost.missing > 0 && dayCost.found > 0 && (
                <Muted style={{ fontSize: 12 }}>
                  Coût chez {store} hors {dayCost.missing} produit(s) dont le prix n’a pas été trouvé.
                </Muted>
              )}
              {day.meals.map((m, i) => (
                <MealCard key={plan.createdAt + ':' + di + ':' + i} meal={m} check={check} store={store} />
              ))}
            </>
          )}

          <NutritionSection title="Courses et budget" subtitle="Liste de courses, magasins et comparaison des prix" icon="basket-outline">
          {/* Prix réels en magasin */}
          <Card style={{ borderColor: colors.dark }}>
            <View style={styles.rowBetween}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="storefront" size={20} color={colors.accentInk} />
                <Text style={styles.cardTitle}>Prix en magasin</Text>
              </View>
              {check && !priceSearch && (
                <Pressable hitSlop={10} onPress={searchRealPrices} accessibilityRole="button" accessibilityLabel="Mettre à jour les prix">
                  <Ionicons name="refresh" size={20} color={colors.muted} />
                </Pressable>
              )}
            </View>

            {priceSearch ? (
              <>
                <Muted>
                  Recherche des prix chez {priceSearch.stores.join(', ')}… ({priceSearch.done.length}/{priceSearch.stores.length} magasin
                  {priceSearch.stores.length > 1 ? 's' : ''}). Ça peut prendre une minute.
                </Muted>
                <ProgressBar ratio={(priceSearch.done.length + 0.3) / priceSearch.stores.length} color={colors.accent} />
              </>
            ) : !stores.length ? (
              <>
                <Muted>Choisis les magasins où tu fais tes courses : le coach y donnera le prix de tes ingrédients.</Muted>
                <Button title="Choisir mes magasins" icon="storefront" onPress={() => router.push('/preferences-repas')} />
              </>
            ) : !check ? (
              <>
                <Muted>
                  Le coach donne le prix de chaque ingrédient chez {stores.join(', ')}. Les prix sont indicatifs : vérifie-les en magasin ou sur le drive.
                </Muted>
                <Button title="Voir les prix" icon="search" onPress={searchRealPrices} />
              </>
            ) : (
              <>
                {totals.map((tot) => {
                  const active = tot.store === store;
                  return (
                    <Pressable key={tot.store} onPress={() => selectStore(tot.store)} style={[styles.storeRow, active && { borderColor: colors.dark, backgroundColor: colors.accentDim }]}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                          <Text style={styles.storeName}>{tot.store}</Text>
                          {cheapest?.store === tot.store && totals.length > 1 && <Tag label="Le moins cher" color={colors.accentInk} />}
                        </View>
                        <Text style={styles.costLabel}>
                          {tot.found} produits sur {tot.total} trouvés
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.storePrice, active && { color: colors.accentInk }]}>{tot.found ? euro(tot.basket) : '—'}</Text>
                        <Text style={styles.costLabel}>à acheter</Text>
                      </View>
                    </Pressable>
                  );
                })}
                {selectedTotal && selectedTotal.found > 0 && (
                  <View style={styles.split}>
                    <View style={styles.splitRow}>
                      <Text style={styles.splitLabel}>Ticket de caisse (paquets entiers)</Text>
                      <Text style={styles.splitValue}>{euro(selectedTotal.basket)}</Text>
                    </View>
                    <View style={styles.splitRow}>
                      <Text style={styles.splitLabel}>Mangé cette semaine</Text>
                      <Text style={styles.splitValue}>{euro(selectedTotal.portions)}</Text>
                    </View>
                    <View style={styles.splitRow}>
                      <Text style={[styles.splitLabel, { color: colors.muted }]}>Reste dans tes placards</Text>
                      <Text style={[styles.splitValue, { color: colors.muted }]}>{euro(Math.max(0, selectedTotal.basket - selectedTotal.portions))}</Text>
                    </View>
                    <Muted style={{ fontSize: 12 }}>
                      Tu achètes des paquets entiers (une bouteille d’huile, un pot de miel…) dont tu n’utilises qu’une partie cette semaine : le reste sert les semaines suivantes.
                    </Muted>
                  </View>
                )}
                {budget && selectedTotal ? (
                  <>
                    <ProgressBar ratio={selectedTotal.portions / budget} color={selectedTotal.portions <= budget ? colors.accent : colors.rest} />
                    <Text style={{ color: selectedTotal.portions <= budget ? colors.accentInk : colors.rest, fontFamily: font.bold }}>
                      {selectedTotal.portions <= budget
                        ? `${selectedTotal.store} : les repas de la semaine tiennent dans ton budget (${budget} €), il reste ${euro(budget - selectedTotal.portions)}`
                        : `${selectedTotal.store} : les repas dépassent ton budget de ${euro(selectedTotal.portions - budget)}`}
                    </Text>
                    {selectedTotal.portions > budget && (
                      <Button
                        title="Demander des menus moins chers"
                        icon="sparkles"
                        variant="secondary"
                        onPress={() => askCoach(`Refais mes menus pour tenir dans mon budget de ${budget} € par semaine (les repas coûtent ${euro(selectedTotal.portions)} chez ${selectedTotal.store}).`, 'cheaper')}
                      />
                    )}
                  </>
                ) : null}
                <Muted style={{ fontSize: 12 }}>
                  Prix indicatifs (relevés le {formatDate(check.searchedAt)}). Appuie sur un magasin pour voir le coût de chaque repas chez lui.
                </Muted>
                {check.stores.some((s) => s.note) && (
                  <Muted style={{ fontSize: 12 }}>
                    {check.stores
                      .filter((s) => s.note)
                      .map((s) => `${s.store} : ${s.note}`)
                      .join(' · ')}
                  </Muted>
                )}
                {check.sources.length > 0 && (
                  <>
                    <Pressable onPress={() => setShowSources((v) => !v)}>
                      <Text style={styles.link}>{showSources ? 'Masquer les sources' : `Voir les sources (${check.sources.length})`}</Text>
                    </Pressable>
                    {showSources &&
                      check.sources.map((src) => (
                        <Pressable key={src.url} accessibilityRole="link" onPress={() => openUrl(src.url)}>
                          <Text style={styles.source} numberOfLines={1}>
                            ↗ {src.title}
                          </Text>
                        </Pressable>
                      ))}
                  </>
                )}
              </>
            )}
          </Card>

          <Card>
            <Pressable style={styles.rowBetween} onPress={() => setShowGroceries((v) => !v)}>
              <Text style={styles.cardTitle}>Liste de courses{check && store ? ` · ${store}` : ''}</Text>
              <Ionicons name={showGroceries ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
            </Pressable>
            {showGroceries &&
              (check && store
                ? check.ingredients.map((ing) => {
                    const pr = check.stores.find((s) => s.store === store)?.items.find((i) => i.id === ing.id);
                    const packs = pr && ing.grams ? Math.max(1, Math.ceil(ing.grams / pr.packGrams)) : undefined;
                    return (
                      <Pressable key={ing.id} disabled={!pr} onPress={() => pr && openUrl(pr.url)} style={styles.groceryRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemFood}>
                            {ing.name} <Text style={styles.itemQty}>· {ing.grams ? gramsLabel(ing.grams) : '?'} sur la semaine</Text>
                          </Text>
                          <Text style={styles.detailText}>{pr ? `${pr.product} · ${pr.packSize} à ${euro(pr.packPrice)}${foundLabel(pr.foundAt ?? check.searchedAt)}` : 'Prix non trouvé en ligne'}</Text>
                        </View>
                        <Text style={styles.itemKcal}>{pr && packs ? `${packs} × = ${euro(packs * pr.packPrice)}` : '—'}</Text>
                      </Pressable>
                    );
                  })
                : plan.groceries.map((g, i) => (
                    <Text key={i} style={styles.grocery}>
                      • {g}
                    </Text>
                  )))}
          </Card>

          </NutritionSection>

        </>
      )}

      <NutritionSection title="Mes préférences et menus" subtitle="Goûts, allergies, conseils et renouvellement des menus" icon="options-outline">
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Mes goûts</Text>
          <Pressable onPress={() => router.push('/preferences-repas')} hitSlop={8}>
            <Text style={styles.link}>{prefsSet ? 'Modifier' : 'Renseigner'}</Text>
          </Pressable>
        </View>
        {prefsSet ? (
          <>
            <View style={styles.tags}>
              <Tag label={DIET_LABEL[prefs.diet]} color={colors.pink} />
              <Tag label={`${prefs.mealsPerDay} repas/jour`} color={colors.yellow} />
              <Tag label={`Cuisine ${prefs.cookingTime}`} color={colors.cyan} />
              {budget ? <Tag label={`Max ${budget} €/sem.`} color={colors.accentInk} icon="wallet" /> : null}
              {stores.map((s) => (
                <Tag key={s} label={s} color={colors.violet} icon="storefront" />
              ))}
            </View>
            {prefs.likes ? <Muted>J’aime : {prefs.likes}</Muted> : null}
            {prefs.dislikes ? <Muted>J’évite : {prefs.dislikes}</Muted> : null}
            {prefs.allergies ? <Muted>Allergies : {prefs.allergies}</Muted> : null}
          </>
        ) : (
          <Muted>Dis-moi ce que tu aimes manger et où tu fais tes courses pour des menus qui te ressemblent.</Muted>
        )}
      </Card>

        {plan && <>
          {plan.tips.length > 0 && (
            <Card>
              <Text style={styles.cardTitle}>Conseils du coach</Text>
              {plan.tips.map((tip, i) => (
                <Muted key={i}>{tip}</Muted>
              ))}
            </Card>
          )}

          <Button
            title="Régénérer mes menus"
            icon="refresh"
            variant="secondary"
            disabled={loading}
            onPress={async () => {
              if (await confirmAction('Nouveau plan de repas ?', 'Le plan actuel sera remplacé. Il faudra relancer la recherche des prix.', 'Régénérer')) generate();
            }}
          />
        </>}
      </NutritionSection>

      <NutritionSection title="Comprendre mes objectifs" subtitle="Calories, nutriments et projection du poids" icon="stats-chart-outline">
      <Panel tone="ink">
        <Text style={styles.heroKicker}>Tes besoins par jour</Text>
        <Text style={styles.heroBig}>
          {t.target}
          <Text style={styles.heroUnit}> kcal</Text>
        </Text>
        <Text style={styles.heroText}>
          Objectif « {GOAL_LABEL[p.goal].toLowerCase()} ». Métabolisme {t.bmr}, quotidien {t.daily}, sport environ {t.trainingPerDay} par jour.
        </Text>
        <Text style={styles.heroText}>Répartition de ta cible quotidienne</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          {macros.map((m) => (
            <View key={m.label} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.macroLabel}>{m.label}</Text>
                <Text style={styles.macroValue}>{m.g} g</Text>
              </View>
              <ProgressBar ratio={m.kcal / t.target} height={8} color={colors.accent} track={colors.darkAlt} label={`${m.label} : objectif de ${m.g} g par jour`} />
            </View>
          ))}
        </View>
      </Panel>
      <Muted style={{ fontSize: 12 }}>
        Estimation recalculée chaque jour à partir de ton profil et des séances prévues cette semaine. Ce n’est pas un avis médical.
      </Muted>

      <ProjectionCard
        data={data}
        intake={plan?.days.length ? Math.round(plan.days.reduce((s, d) => s + d.kcal, 0) / plan.days.length) : t.target}
        fromPlan={!!plan?.days.length}
      />
      </NutritionSection>

    </Screen>
  );
}

function NutritionSection({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: IconName; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card>
      <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} accessibilityState={{ expanded }} onPress={() => setExpanded((v) => !v)} style={[styles.rowBetween, { minHeight: 48 }]}>
        <Ionicons name={icon} size={21} color={colors.accentInk} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Muted>{subtitle}</Muted>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
      {expanded && <View style={{ gap: spacing.md, paddingTop: spacing.sm }}>{children}</View>}
    </Card>
  );
}

function costOf(items: MealItem[], check: PriceCheck | undefined, store: string | undefined) {
  if (!check || !store) return undefined;
  let cost = 0;
  let found = 0;
  let missing = 0;
  for (const it of items) {
    const r = itemPrice(it, check, store);
    if (r?.cost != null) {
      cost += r.cost;
      found++;
    } else missing++;
  }
  return { cost, found, missing };
}

function MealCard({ meal, check, store }: { meal: Meal; check?: PriceCheck; store?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const c = costOf(meal.items, check, store);
  return (
    <Card>
      <Pressable style={[styles.rowBetween, { minHeight: 44 }]} accessibilityRole="button" accessibilityLabel={meal.name + ', quantités et recette'} accessibilityState={{ expanded }} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.mealName}>
          {meal.name}
          {meal.time ? <Text style={styles.mealTime}> · {meal.time}</Text> : null}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.mealKcal}>{meal.kcal} kcal</Text>
          {c && c.found > 0 && <Text style={styles.mealCost}>{euro(c.cost)}</Text>}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {!expanded && <Text style={styles.mealSummary} numberOfLines={2}>{meal.items.map((it) => it.food).join(', ')}</Text>}
      {expanded && <>
      {meal.items.map((it, k) => (
        <ItemRow key={k} item={it} check={check} store={store} open={open === k} onPress={() => setOpen(open === k ? null : k)} />
      ))}
      {meal.recipe ? (
        <View style={styles.recipe}>
          <Ionicons name="restaurant-outline" size={14} color={colors.muted} />
          <Text style={styles.recipeText}>{meal.recipe}</Text>
        </View>
      ) : null}
      </>}
    </Card>
  );
}

function ItemRow({ item, check, store, open, onPress }: { item: MealItem; check?: PriceCheck; store?: string; open: boolean; onPress: () => void }) {
  const r = itemPrice(item, check, store);
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 2 }}>
      <View style={styles.item}>
        <Text style={styles.itemFood}>
          {item.food} <Text style={styles.itemQty}>· {item.qty}</Text>
        </Text>
        <Text style={styles.itemKcal}>
          {item.kcal}
          {r?.cost != null ? <Text style={styles.itemCost}> · {euro(r.cost)}</Text> : null}
        </Text>
      </View>
      {open && check && store && (
        <View style={styles.details}>
          {r ? (
            <>
              <Text style={styles.detailText}>
                {store} : {r.price.product} · {r.price.packSize} à {euro(r.price.packPrice)} ({euro(r.price.pricePerKg)}/kg){foundLabel(r.price.foundAt ?? check.searchedAt)}
                {r.price.minPerKg && r.price.maxPerKg ? `. Selon la variété : de ${euro(r.price.minPerKg)} à ${euro(r.price.maxPerKg)} le kilo.` : ''}
                {r.price.verified ? ' Prix lu en ligne.' : ' Prix indicatif, non vérifié en ligne.'}
              </Text>
              <Pressable accessibilityRole="link" onPress={() => openUrl(r.price.url)}>
                <Text style={styles.source}>↗ Voir la page du produit</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.detailText}>Prix non trouvé en ligne chez {store}.</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const HORIZONS = [
  { label: '1 mois', weeks: 4 },
  { label: '2 mois', weeks: 8 },
  { label: '3 mois', weeks: 13 },
];

/** « Et si je suis ce plan ? » : évolution estimée du poids selon les kcal moyennes mangées. */
function ProjectionCard({ data, intake, fromPlan }: { data: AppData; intake: number; fromPlan: boolean }) {
  const [weeks, setWeeks] = useState(4);
  const [custom, setCustom] = useState<number | null>(null);
  const kcal = custom ?? intake;
  const pr = projectWeight(data, kcal, weeks);
  const w0 = data.profile.weightKg;
  const delta = Math.round((pr.endKg - w0) * 10) / 10;
  const min = Math.min(...pr.weeks);
  const max = Math.max(...pr.weeks);
  const span = Math.max(0.5, max - min);
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const color = pr.warning ? colors.rest : colors.accentInk;
  // Réel vs projection : depuis la première pesée des 8 dernières semaines.
  const sorted = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1];
  const since = last ? new Date(last.date).getTime() - 56 * 86400000 : 0;
  const first = sorted.find((x) => new Date(x.date).getTime() >= since);
  const spanDays = first && last ? (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000 : 0;
  const realPerWeek = spanDays >= 7 && first && last ? Math.round(((last.kg - first.kg) / spanDays) * 7 * 100) / 100 : undefined;
  return (
    <Card>
      <Text style={styles.cardTitle}>Et si je suis ce plan ?</Text>
      <Muted>
        {custom != null ? `Si tu manges ${kcal} kcal par jour` : fromPlan ? `En mangeant la moyenne de ton plan (${kcal} kcal/jour)` : `En mangeant ta cible (${kcal} kcal/jour)`}, avec tes séances prévues.
      </Muted>
      <View style={styles.tags}>
        {HORIZONS.map((h) => (
          <Chip key={h.weeks} label={h.label} active={weeks === h.weeks} onPress={() => setWeeks(h.weeks)} />
        ))}
      </View>
      <View style={styles.tags}>
        <Chip label={fromPlan ? 'Mon plan' : 'Ma cible'} active={custom == null} onPress={() => setCustom(null)} />
        <Chip label="− 200 kcal" active={custom === intake - 200} onPress={() => setCustom(intake - 200)} />
        <Chip label="+ 200 kcal" active={custom === intake + 200} onPress={() => setCustom(intake + 200)} />
      </View>
      <Text style={{ color, fontFamily: font.black, fontSize: 30, fontVariant: ['tabular-nums'] }}>
        {fmt(w0)} → {fmt(pr.endKg)} kg
      </Text>
      <Text style={{ color: colors.text, fontFamily: font.bold }}>
        {delta === 0 ? 'Poids stable' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta))} kg`} en {weeks === 4 ? '1 mois' : weeks === 8 ? '2 mois' : '3 mois'}, soit {pr.perWeekKg > 0 ? '+' : pr.perWeekKg < 0 ? '−' : ''}
        {Math.abs(pr.perWeekKg).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} kg par semaine
      </Text>
      <Muted>
        Fourchette réaliste : {fmt(Math.min(pr.lowKg, pr.highKg))} à {fmt(Math.max(pr.lowKg, pr.highKg))} kg. Ton corps dépense environ {pr.maintenance} kcal par jour, soit un bilan de {pr.balance > 0 ? '+' : ''}
        {pr.balance} kcal.
      </Muted>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 64 }} accessibilityLabel="Évolution estimée du poids semaine par semaine">
        {pr.weeks.map((v, i) => (
          <View key={i} style={{ flex: 1, height: 10 + ((v - min) / span) * 54, backgroundColor: i === 0 ? colors.borderStrong : color, borderRadius: 3, opacity: i === 0 ? 1 : 0.35 + (0.65 * i) / pr.weeks.length }} />
        ))}
      </View>
      {realPerWeek != null ? (
        <Muted>
          Ta courbe réelle : {realPerWeek > 0 ? '+' : realPerWeek < 0 ? '−' : ''}
          {Math.abs(realPerWeek).toLocaleString('fr-FR')} kg par semaine depuis le {formatDate(first?.date ?? "")}, contre {pr.perWeekKg > 0 ? '+' : pr.perWeekKg < 0 ? '−' : ''}
          {Math.abs(pr.perWeekKg).toLocaleString('fr-FR')} prévu.{' '}
          {Math.abs(realPerWeek - pr.perWeekKg) <= 0.15 ? 'Tu es dans la trajectoire.' : realPerWeek > pr.perWeekKg ? 'Tu évolues plus haut que prévu : vérifie tes quantités ou ton activité.' : 'Tu évolues plus bas que prévu.'}
        </Muted>
      ) : (
        <Muted>Pèse-toi chaque semaine pour comparer ta vraie courbe à cette projection.</Muted>
      )}
      {pr.warning ? <Text style={{ color: colors.rest, fontFamily: font.bold }}>{pr.warning}</Text> : null}
      <Muted style={{ fontSize: 12 }}>
        Estimation simple (7 700 kcal ≈ 1 kg) : le poids réel dépend de l’eau, du sommeil, de la masse musculaire et de la régularité. Ce n’est pas un avis médical.
      </Muted>
    </Card>
  );
}

const styles = StyleSheet.create({
  offIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center' },
  offTitle: { color: colors.text, ...type.h2 },
  heroKicker: { color: colors.accent, fontFamily: font.black, fontSize: 14 },
  heroBig: { color: colors.onDark, fontFamily: font.black, fontSize: 52, lineHeight: 56, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  heroUnit: { fontSize: 18, fontFamily: font.black, color: colors.onDarkMuted, letterSpacing: 0 },
  heroText: { color: colors.onDarkMuted, ...type.small, fontSize: 14, lineHeight: 20 },
  macroLabel: { color: colors.onDark, fontFamily: font.bold },
  macroValue: { color: colors.onDark, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { color: colors.text, fontFamily: font.black, fontSize: 17 },
  link: { color: colors.accentInk, fontFamily: font.black },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm + 2, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border },
  storeName: { color: colors.text, fontFamily: font.black, fontSize: 15 },
  storePrice: { color: colors.text, fontFamily: font.black, fontSize: 18, fontVariant: ['tabular-nums'] },
  costLabel: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
  split: { gap: 6, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.ms },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  splitLabel: { color: colors.text, fontFamily: font.bold, fontSize: 14, flex: 1 },
  splitValue: { color: colors.text, fontFamily: font.black, fontSize: 15, fontVariant: ['tabular-nums'] },
  source: { color: colors.cyan, fontSize: 12, fontFamily: font.bold },
  mealSummary: { color: colors.muted, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  mealName: { color: colors.text, fontFamily: font.black, fontSize: 16, flex: 1 },
  mealTime: { color: colors.muted, fontFamily: font.bold, fontSize: 13 },
  mealKcal: { color: colors.text, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  mealCost: { color: colors.accentInk, fontFamily: font.black, fontSize: 13 },
  item: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 2 },
  itemFood: { fontFamily: font.regular, color: colors.text, flex: 1, fontSize: 14 },
  itemQty: { color: colors.muted },
  itemKcal: { fontFamily: font.regular, color: colors.muted, fontVariant: ['tabular-nums'], fontSize: 13 },
  itemCost: { color: colors.accentInk },
  details: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, padding: spacing.sm, gap: 3, marginVertical: 4 },
  detailText: { fontFamily: font.regular, color: colors.muted, fontSize: 12, lineHeight: 17 },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  recipe: { flexDirection: 'row', gap: 6, backgroundColor: colors.cardAlt, padding: spacing.sm, borderRadius: radius.sm, marginTop: 4 },
  recipeText: { fontFamily: font.regular, color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  grocery: { fontFamily: font.regular, color: colors.text, fontSize: 14, lineHeight: 22 },
});
