import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
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
import Svg, { Circle } from 'react-native-svg';

import {
  CategoryColors,
  CategoryIcons,
  Colors,
  Fonts,
  Radius,
  Shadow,
  Spacing,
} from '@/constants/theme';
import { tap } from '@/lib/haptics';
import type { Category } from '@/lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  dark,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  dark?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={[styles.screen, dark && styles.screenDark]} edges={edges}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scrollContent, styles.fill, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

/** Petit texte en capitales au-dessus d'un titre. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, style]}>{children}</Text>;
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

export function Card({
  children,
  style,
  variant = 'default',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'dark' | 'soft';
}) {
  return <View style={[styles.card, styles[`card_${variant}`], style]}>{children}</View>;
}

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'onDark';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'md',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  size?: 'md' | 'sm';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = BUTTON_TEXT[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSmall,
        styles[`button_${variant}`],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={color} />}
      <Text style={[styles.buttonLabel, size === 'sm' && styles.buttonLabelSmall, { color }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const BUTTON_TEXT: Record<ButtonVariant, string> = {
  primary: Colors.white,
  accent: Colors.ink,
  secondary: Colors.text,
  ghost: Colors.textSecondary,
  onDark: Colors.white,
};

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      {icon && <Ionicons name={icon} size={16} color={selected ? Colors.white : Colors.text} />}
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function ProgressBar({
  value,
  color = Colors.ink,
  track = Colors.surface,
  height = 8,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { backgroundColor: track, height }]}>
      <View style={[styles.bar, { width: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

/** Anneau de progression, avec un contenu centré (chiffre, icône). */
export function ProgressRing({
  value,
  size = 72,
  stroke = 8,
  color = Colors.accent,
  track = Colors.surface,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

/** Pastille carrée arrondie avec une icône. */
export function IconTile({
  icon,
  tint = Colors.surface,
  color = Colors.text,
  size = 44,
}: {
  icon: IconName;
  tint?: string;
  color?: string;
  size?: number;
}) {
  return (
    <View style={[styles.iconTile, { width: size, height: size, backgroundColor: tint, borderRadius: size * 0.32 }]}>
      <Ionicons name={icon} size={size * 0.48} color={color} />
    </View>
  );
}

export function CategoryTile({ category, size = 44 }: { category: Category; size?: number }) {
  const { tint, icon } = CategoryColors[category];
  return <IconTile icon={CategoryIcons[category]} tint={tint} color={icon} size={size} />;
}

export function Badge({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'dark';
  icon?: IconName;
}) {
  const color = tone === 'dark' ? Colors.white : Colors.ink;
  return (
    <View style={[styles.badge, styles[`badge_${tone}`]]}>
      {icon && <Ionicons name={icon} size={13} color={color} />}
      <Text style={[styles.badgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  screenDark: { backgroundColor: Colors.ink },
  scrollContent: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xl },
  fill: { flex: 1 },
  title: { fontSize: 30, lineHeight: 36, fontFamily: Fonts.extrabold, color: Colors.text, letterSpacing: -0.8 },
  eyebrow: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  heading: { fontSize: 20, lineHeight: 26, fontFamily: Fonts.bold, color: Colors.text, letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 23, fontFamily: Fonts.regular, color: Colors.text },
  muted: { color: Colors.textSecondary },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    gap: Spacing.sm + 2,
  },
  card_default: { backgroundColor: Colors.card, ...Shadow },
  card_dark: { backgroundColor: Colors.ink },
  card_soft: { backgroundColor: Colors.surface },
  button: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: Radius.pill,
    minHeight: 54,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { minHeight: 40, paddingHorizontal: Spacing.md },
  button_primary: { backgroundColor: Colors.ink },
  button_accent: { backgroundColor: Colors.accent },
  button_secondary: { backgroundColor: Colors.surface },
  button_ghost: { backgroundColor: 'transparent' },
  button_onDark: { backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  buttonLabel: { fontSize: 16, fontFamily: Fonts.bold },
  buttonLabelSmall: { fontSize: 14 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.35 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.ink, borderColor: Colors.ink },
  chipLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.text },
  chipLabelSelected: { color: Colors.white },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  track: { borderRadius: Radius.pill, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: Radius.pill },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  iconTile: { alignItems: 'center', justifyContent: 'center' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
  },
  badge_neutral: { backgroundColor: Colors.surface },
  badge_accent: { backgroundColor: Colors.accent },
  badge_dark: { backgroundColor: 'rgba(255, 255, 255, 0.12)' },
  badgeLabel: { fontSize: 12, fontFamily: Fonts.bold },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  sectionTitle: { fontSize: 18, fontFamily: Fonts.bold, color: Colors.text, letterSpacing: -0.2 },
});
