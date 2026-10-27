import { useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { BarChart } from '@/components/BarChart';
import { Notice, ProgressBar, Segmented } from '@/components/kit';
import { Button, Card, difficultyLabel, energyLabel, H2, IconButton, Muted, Screen, Stat } from '@/components/ui';
import { confirmAction, notify } from '@/lib/confirm';
import { formatDate, formatShort, lastWeeks, weekKey } from '@/lib/date';
import { countByWeek, weekStreak } from '@/lib/stats';
import { useApp } from '@/store/AppStore';
import { colors, font, radius, spacing, type } from '@/theme';

export default function Progres() {
  const { data, addWeight, deleteWeight } = useApp();
  const [kgText, setKgText] = useState('');

  const totalMin = data.logs.reduce((a, l) => a + l.durationMin, 0);
  const byWeek = countByWeek(data.logs);
  const [period, setPeriod] = useState<'4' | '8' | '12'>('8');
  const currentWeek = byWeek.get(weekKey(new Date()));
  const completed = currentWeek?.count ?? 0;
  const goal = Math.max(1, data.profile.sessionsPerWeek);
  const weeks = lastWeeks(Number(period));
  const minutesBars = weeks.map((w, i) => ({
    label: formatShort(w),
    value: byWeek.get(weekKey(w))?.minutes ?? 0,
    highlight: i === weeks.length - 1,
  }));

  const recent = data.logs.slice(0, 10).reverse();
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const avgDiff = avg(recent.map((l) => l.difficulty));
  const avgEnergy = avg(recent.map((l) => l.energy));

  const weights = data.weights.slice(-10);
  const minKg = weights.length ? Math.min(...weights.map((w) => w.kg)) : 0;
  const firstKg = data.weights[0]?.kg;
  const lastKg = data.weights[data.weights.length - 1]?.kg;
  const delta = firstKg != null && lastKg != null ? lastKg - firstKg : 0;

  const submitWeight = () => {
    const kg = parseFloat(kgText.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 25 || kg > 300) {
      notify('Poids invalide', 'Entre un poids en kg, par exemple 72,5.');
      return;
    }
    addWeight(Math.round(kg * 10) / 10);
    setKgText('');
    Keyboard.dismiss();
  };

  return (
    <Screen top={false}>

      <Card>
        <Muted>CETTE SEMAINE</Muted>
        <Text style={{ color: colors.accent, fontFamily: font.black, fontSize: 36 }}>{completed}<Text style={{ color: colors.muted, fontSize: 20 }}> / {goal} séances</Text></Text>
        <ProgressBar ratio={completed / goal} label={completed + ' séances terminées sur un objectif de ' + goal} />
        <Muted>{completed >= goal ? 'Ton objectif est atteint. Chaque séance supplémentaire est un bonus.' : completed === 0 ? 'Ta prochaine séance sera le premier pas de la semaine.' : 'Encore ' + (goal - completed) + ' séance(s) pour atteindre ton objectif.'}</Muted>
      </Card>
      <Muted>DEPUIS TES DÉBUTS</Muted>
      <View style={styles.statsRow}>
        <Stat value={`${data.logs.length}`} label="séances" accent />
        <Stat value={totalMin >= 60 ? `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}` : `${totalMin}`} label={totalMin >= 60 ? 'au total' : 'minutes'} />
        <Stat value={`${weekStreak(data.logs, data.profile.sessionsPerWeek)}`} label="semaines d’affilée" />
      </View>

      <Card>
        <H2>Minutes par semaine</H2>
        <Segmented label="Période du graphique" value={period} onChange={setPeriod} options={[{ value: '4', label: '4 sem.' }, { value: '8', label: '8 sem.' }, { value: '12', label: '12 sem.' }]} />
        <BarChart bars={minutesBars} label="Minutes d’entraînement par semaine" />
      </Card>

      <Card>
        <H2>Ressenti</H2>
        {recent.length === 0 ? (
          <Muted>Termine une séance pour voir ton ressenti évoluer.</Muted>
        ) : (
          <>
            <Muted>
              Sur tes {recent.length} dernières séances : difficulté « {difficultyLabel(Math.round(avgDiff))} », énergie «{' '}
              {energyLabel(Math.round(avgEnergy))} ».
            </Muted>
            <Text style={styles.chartLabel}>Énergie après séance</Text>
            <BarChart label="Énergie après chaque séance, de 1 à 5" bars={recent.map((l, i) => ({ label: formatShort(new Date(l.date)), value: l.energy, highlight: i === recent.length - 1 }))} height={90} />
            {avgDiff >= 4.2 && (
              <Notice tone="warning">
                <Muted>Les séances sont dures en ce moment : demande au coach d’alléger un peu ton programme.</Muted>
              </Notice>
            )}
            {avgDiff <= 1.8 && recent.length >= 3 && (
              <Notice tone="success">
                <Muted>Ça devient facile : demande au coach de corser un peu le programme.</Muted>
              </Notice>
            )}
          </>
        )}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <H2>Poids</H2>
          {data.weights.length >= 2 && (
            <Text style={[styles.delta, { color: delta <= 0 ? colors.accentInk : colors.rest }]}>
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} kg depuis le début
            </Text>
          )}
        </View>
        <View style={styles.inputRow}>
          <TextInput
            value={kgText}
            onChangeText={setKgText}
            placeholder={lastKg ? `${lastKg}` : 'ex : 72,5'}
            placeholderTextColor={colors.muted}
            accessibilityLabel="Nouveau poids en kilos"
            keyboardType="decimal-pad"
            style={styles.input}
            onSubmitEditing={submitWeight}
            returnKeyType="done"
          />
          <Text style={styles.unit}>kg</Text>
          <Button title="Ajouter" onPress={submitWeight} disabled={!kgText.trim()} style={{ flexShrink: 0 }} />
        </View>
        {weights.length > 0 && (
          <BarChart
            label="Pesées récentes, en kilos"
            bars={weights.map((w, i) => ({ label: formatShort(new Date(w.date)), value: w.kg, highlight: i === weights.length - 1 }))}
            min={Math.floor(minKg) - 2}
            height={110}
          />
        )}
        {data.weights
          .slice()
          .reverse()
          .slice(0, 5)
          .map((w) => (
            <View key={w.id} style={styles.weightRow}>
              <Text style={styles.weightDate}>{formatDate(w.date)}</Text>
              <Text style={styles.weightKg}>{w.kg} kg</Text>
              <IconButton
                icon="trash-outline"
                plain
                size={18}
                color={colors.muted}
                label={`Supprimer la pesée de ${w.kg} kg du ${formatDate(w.date)}`}
                onPress={() =>
                  void confirmAction('Supprimer cette pesée ?', `${w.kg} kg, ${formatDate(w.date)}.`, 'Supprimer', true).then((ok) => {
                    if (ok) deleteWeight(w.id);
                  })
                }
              />
            </View>
          ))}
        {data.weights.length > 0 && <Muted style={{ fontSize: 12 }}>Pèse-toi idéalement le matin, une fois par semaine.</Muted>}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  chartLabel: { color: colors.muted, fontSize: 12, fontFamily: font.bold, marginTop: spacing.xs },
  delta: { fontFamily: font.bold, fontSize: 13 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: { flex: 1, minWidth: 0, minHeight: 48, color: colors.text, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.sm + 2, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 18, fontFamily: font.bold, fontVariant: ['tabular-nums'] },
  unit: { color: colors.muted, fontFamily: font.bold },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border },
  weightDate: { color: colors.muted, ...type.small, fontSize: 14, flex: 1 },
  weightKg: { color: colors.text, fontFamily: font.bold, fontVariant: ['tabular-nums'] },
});
