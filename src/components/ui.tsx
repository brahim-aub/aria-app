import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { focusRing, PressState, pressFeedback } from '@/lib/motion';
import { colors, font, layout, radius, readableOn, spacing, type } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const tick = () => Haptics.selectionAsync().catch(() => {});

/** Typographie française : espace insécable avant ? ! : ; pour éviter un signe seul en début de ligne. */
export const frenchSpacing = (t: ReactNode): ReactNode => (typeof t === 'string' ? t.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ') : t);

/** Page standard : fond papier, contenu centré et limité en largeur (tablette, web). */
export function Screen({ children, scroll = true, top = true }: { children: ReactNode; scroll?: boolean; top?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={top ? ['top', 'left', 'right'] : ['left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.scrollContent, { flex: 1 }]}>
          <View style={[styles.column, { flex: 1 }]}>{children}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text role="heading" aria-level={1} style={[styles.h1, style]}>
      {frenchSpacing(children)}
    </Text>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text role="heading" aria-level={2} style={[styles.h2, style]}>
      {frenchSpacing(children)}
    </Text>
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function Card({ children, style, onPress, label }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={(s: PressState) => [styles.card, pressFeedback(s, 0.99), focusRing(s), style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  /** primary : encre · accent : citron (action unique de l'écran) · secondary · ghost · danger */
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  /** Fond personnalisé : le texte se cale automatiquement sur l'encre ou le blanc. */
  color?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  loading?: boolean;
  big?: boolean;
  accessibilityHint?: string;
};

export function Button({ title, onPress, variant = 'primary', icon, style, disabled, loading, big, color, accessibilityHint }: ButtonProps) {
  const bg = color && variant === 'primary' ? color : { primary: colors.accent, accent: colors.accent, secondary: colors.card, ghost: 'transparent', danger: colors.pinkDim }[variant];
  const fg = color && variant === 'primary' ? readableOn(color) : { primary: colors.onAccent, accent: colors.onAccent, secondary: colors.text, ghost: colors.text, danger: colors.danger }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={() => {
        tick();
        onPress();
      }}
      style={(s: PressState) => [
        styles.button,
        big && styles.buttonBig,
        { backgroundColor: bg },
        variant === 'secondary' && styles.buttonSecondary,
        s.hovered && !inactive && { opacity: 0.9 },
        !inactive && pressFeedback(s),
        inactive && { opacity: 0.42 },
        focusRing(s),
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={big ? 20 : 18} color={fg} /> : null}
      <Text style={[styles.buttonText, big && styles.buttonTextBig, { color: fg }]} numberOfLines={2}>
        {title}
      </Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color = colors.text, size = 22, plain }: { icon: IconName; onPress: () => void; label: string; color?: string; size?: number; plain?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={(s: PressState) => [styles.iconButton, plain && styles.iconButtonPlain, pressFeedback(s, 0.94), focusRing(s, 22)]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** Puce de choix : sélection simple ou multiple selon l'usage (l'état est annoncé). */
export function Chip({ label, active, onPress, color = colors.accentInk, icon }: { label: string; active?: boolean; onPress: () => void; color?: string; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => {
        tick();
        onPress();
      }}
      style={(s: PressState) => [styles.chip, active && styles.chipActive, !active && s.hovered && { borderColor: colors.borderStrong }, pressFeedback(s, 0.96), focusRing(s)]}
    >
      {active ? <Ionicons name="checkmark" size={15} color={colors.accent} /> : icon ? <Ionicons name={icon} size={15} color={color} /> : null}
      <Text style={[styles.chipText, active && { color: colors.onDark }]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 999, format, label }: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  label?: string;
}) {
  const shown = format ? format(value) : String(value);
  return (
    <View
      style={styles.stepper}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: shown }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(e.nativeEvent.actionName === 'increment' ? Math.min(max, value + step) : Math.max(min, value - step))}
    >
      <IconButton icon="remove" label="Moins" onPress={() => onChange(Math.max(min, value - step))} />
      <Text style={styles.stepperValue}>{shown}</Text>
      <IconButton icon="add" label="Plus" onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

const DIFFICULTY = ['Très facile', 'Facile', 'Correct', 'Dur', 'Très dur'];
const ENERGY = ['Vidé', 'Fatigué', 'Normal', 'En forme', 'Au top'];

export const difficultyLabel = (v: number) => DIFFICULTY[v - 1] ?? '';
export const energyLabel = (v: number) => ENERGY[v - 1] ?? '';

export function RatingPicker({ kind, value, onChange }: { kind: 'difficulty' | 'energy'; value: number; onChange: (v: number) => void }) {
  const labels = kind === 'difficulty' ? DIFFICULTY : ENERGY;
  return (
    <View>
      <View style={styles.ratingRow} accessibilityRole="radiogroup">
        {labels.map((name, i) => {
          const v = i + 1;
          const active = v === value;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={`${v}, ${name}`}
              accessibilityState={{ checked: active }}
              onPress={() => {
                tick();
                onChange(v);
              }}
              style={(s: PressState) => [styles.ratingDot, active && styles.ratingDotActive, pressFeedback(s, 0.94), focusRing(s)]}
            >
              <Text style={[styles.ratingNum, active && { color: colors.onAccent }]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.ratingLabel}>{labels[value - 1]}</Text>
    </View>
  );
}

export function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${value} ${label}`}>
      <Text style={[styles.statValue, accent && { color: colors.accentInk }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  column: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', gap: spacing.lg },
  h1: { color: colors.text, ...type.title },
  h2: { color: colors.text, ...type.h2 },
  muted: { color: colors.muted, ...type.small, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  button: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 12, paddingHorizontal: spacing.md + 2, borderRadius: radius.pill },
  buttonBig: { minHeight: 56, paddingVertical: 16 },
  buttonSecondary: { borderWidth: 1, borderColor: colors.borderStrong },
  buttonText: { fontSize: 15, fontFamily: font.bold, flexShrink: 1, textAlign: 'center' },
  buttonTextBig: { fontSize: 17, fontFamily: font.black },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  iconButtonPlain: { backgroundColor: 'transparent', borderWidth: 0 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  chipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  chipText: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepperValue: { color: colors.text, fontSize: 20, fontFamily: font.black, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  ratingDot: { flex: 1, aspectRatio: 1, maxWidth: 56, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  ratingDotActive: { backgroundColor: colors.accent, borderColor: colors.dark },
  ratingNum: { color: colors.text, fontSize: 18, fontFamily: font.black },
  ratingLabel: { color: colors.text, fontFamily: font.bold, textAlign: 'center', marginTop: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  statValue: { color: colors.text, fontSize: 24, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  statLabel: { color: colors.muted, ...type.small, marginTop: 2 },
});
