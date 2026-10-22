import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, font } from '@/theme';

export type Bar = { label: string; value: number; highlight?: boolean };

/** Histogramme minimal en Views, sans dépendance native. */
export function BarChart({ bars, height = 120, unit = '', min, label }: { bars: Bar[]; height?: number; unit?: string; min?: number; label?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const floor = min ?? 0;
  const span = Math.max(1, max - floor);
  const empty = bars.every((x) => x.value <= 0);
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label ? label + ' : ' : ''}${bars.map((b) => `${b.label} ${Number.isInteger(b.value) ? b.value : b.value.toFixed(1)}${unit}`).join(', ')}`}
    >
      <View style={[styles.bars, { height }]}>
        {empty && <Text style={styles.empty}>Pas encore de données.</Text>}
        {bars.map((b, i) => {
          const ratio = b.value <= 0 ? 0 : Math.max(0.04, (b.value - floor) / span);
          return (
            <View key={i} style={styles.col}>
              {b.value > 0 && (
                <Text style={styles.value} numberOfLines={1}>
                  {Number.isInteger(b.value) ? b.value : b.value.toFixed(1)}
                  {unit}
                </Text>
              )}
              <View
                style={[
                  styles.bar,
                  { height: Math.max(3, ratio * (height - 18)), backgroundColor: b.highlight ? colors.accent : b.value > 0 ? colors.darkAlt : colors.border },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {bars.map((b, i) => (
          <Text key={i} style={styles.label} numberOfLines={1}>
            {b.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', maxWidth: 40, borderRadius: 6 },
  empty: { position: 'absolute', top: '35%', left: 0, right: 0, textAlign: 'center', color: colors.muted, fontFamily: font.bold, fontSize: 13 },
  value: { fontFamily: font.bold, color: colors.muted, fontSize: 11, marginBottom: 2, fontVariant: ['tabular-nums'] },
  labels: { flexDirection: 'row', gap: 6 },
  label: { fontFamily: font.regular, flex: 1, color: colors.muted, fontSize: 11, textAlign: 'center' },
});
