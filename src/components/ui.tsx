import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Colors, Radius, Spacing } from '@/constants/theme';

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
      ) : (
        <View style={[styles.scrollContent, styles.fill]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Body({
  children,
  muted,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <Text style={[styles.buttonLabel, variant !== 'primary' && styles.buttonLabelAlt]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function ProgressBar({ value, color = Colors.accent }: { value: number; color?: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={styles.track}>
      <View style={[styles.bar, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  fill: { flex: 1 },
  title: { fontSize: 26, fontWeight: '600', color: Colors.text },
  body: { fontSize: 16, lineHeight: 23, color: Colors.text },
  muted: { color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    borderRadius: Radius.pill,
    paddingVertical: 15,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  primary: { backgroundColor: Colors.primary },
  secondary: { backgroundColor: Colors.surface },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.4 },
  buttonLabel: { color: Colors.white, fontSize: 16, fontWeight: '600' },
  buttonLabelAlt: { color: Colors.text },
  chip: {
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipLabel: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  chipLabelSelected: { color: Colors.white },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  track: {
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    overflow: 'hidden',
  },
  bar: { height: '100%', borderRadius: Radius.pill },
});
