import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { EXERCISES, musclesLabel } from '@/data/exercises';
import { focusRing, PressState, pressFeedback, useReducedMotion } from '@/lib/motion';
import { prescriptionLabel } from '@/lib/workout';
import type { SessionExercise } from '@/store/types';
import { colors, font, motion, radius, spacing, type } from '@/theme';

import { frenchSpacing, type IconName } from './ui';

export type PanelTone = 'ink' | 'accent' | 'surface';

const PANEL_BG: Record<PanelTone, string> = { ink: colors.dark, accent: colors.accent, surface: colors.card };

/** Bloc fort d'un écran. `ink` est réservé à l'élément principal (un seul par écran). */
/** `group={false}` : la carte reste touchable mais ses boutons internes restent accessibles un par un (lecteurs d'écran). */
export function Panel({ tone = 'surface', children, style, onPress, label, group = true }: { tone?: PanelTone; children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; label?: string; group?: boolean }) {
  const base = [s.panel, { backgroundColor: PANEL_BG[tone] }, tone === 'surface' && s.panelSurface];
  if (!onPress) return <View style={[...base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessible={group} accessibilityRole={group ? "button" : undefined} accessibilityLabel={label} style={(st: PressState) => [...base, pressFeedback(st, 0.99), focusRing(st, radius.lg), style]}>
      {children}
    </Pressable>
  );
}

export function Tag({ label, color = colors.accentInk, icon }: { label: string; color?: string; icon?: IconName }) {
  return (
    <View style={[s.tag, { backgroundColor: color + '17' }]}>
      {icon && <Ionicons name={icon} size={12} color={color} />}
      <Text style={[s.tagText, { color }]}>{label}</Text>
    </View>
  );
}

/** Jauge : le remplissage s'anime à chaque changement (sauf « réduire les animations »). */
export function ProgressBar({ ratio, color = colors.accent, height = 8, track = colors.cardAlt, label }: { ratio: number; color?: string; height?: number; track?: string; label?: string }) {
  const r = Math.max(0, Math.min(1, ratio || 0));
  const reduced = useReducedMotion();
  const [anim] = useState(() => new Animated.Value(r));
  const first = useRef(true);
  useEffect(() => {
    if (reduced || first.current) {
      first.current = false;
      anim.setValue(r);
      return;
    }
    Animated.timing(anim, { toValue: r, duration: motion.fill, useNativeDriver: false }).start();
  }, [r, reduced, anim]);
  return (
    <View
      style={[s.track, { height, borderRadius: height / 2, backgroundColor: track }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(r * 100) }}
    >
      <Animated.View style={{ width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), height: '100%', backgroundColor: color, borderRadius: height / 2 }} />
    </View>
  );
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHeader}>
      <Text style={s.sectionTitle} role="heading" aria-level={2}>
        {frenchSpacing(title)}
      </Text>
      {action && onAction && (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link" style={(st: PressState) => [s.sectionActionWrap, focusRing(st, 6), st.pressed && { opacity: 0.6 }]}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

/**
 * Choix en carte. `multiple` : case à cocher (sinon bouton radio).
 * Sélectionnée : filet encre épais et pastille citron, sans inverser toute la carte.
 */
export function OptionCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
  color = colors.text,
  multiple,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  selected?: boolean;
  onPress: () => void;
  color?: string;
  multiple?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={(st: PressState) => [s.option, selected && s.optionSelected, !selected && st.hovered && { borderColor: colors.borderStrong }, pressFeedback(st, 0.99), focusRing(st, radius.md)]}
    >
      {icon && (
        <View style={[s.optionIcon, selected && { backgroundColor: colors.accent }]}>
          <Ionicons name={icon} size={22} color={selected ? colors.onAccent : color} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        {subtitle ? <Text style={s.optionSub}>{subtitle}</Text> : null}
      </View>
      <View style={[multiple ? s.checkBox : s.radio, selected && s.markOn]}>{selected && <Ionicons name="checkmark" size={15} color={colors.onAccent} />}</View>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string; error?: string; hint?: string }) {
  const { label, error, hint, style, onFocus, onBlur, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={s.fieldLabel}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
        accessibilityHint={error ?? hint}
        aria-invalid={!!error}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[s.field, focused && s.fieldFocused, !!error && s.fieldError, rest.multiline && { minHeight: 88, textAlignVertical: 'top' }, style]}
      />
      {error ? (
        <View style={s.fieldMsg} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text style={[s.fieldMsgText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={s.fieldMsgText}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function ExerciseRow({ e, index, onPress, right }: { e: SessionExercise; index?: number; onPress?: () => void; right?: ReactNode }) {
  const ex = EXERCISES[e.exerciseId];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={(st: PressState) => [s.exRow, st.pressed && { opacity: 0.7 }, focusRing(st, radius.sm)]}
    >
      {index != null && (
        <View style={s.exIndex}>
          <Text style={s.exIndexText}>{index + 1}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.exName}>{ex?.name ?? e.exerciseId}</Text>
        <Text style={s.exMeta}>
          {prescriptionLabel(e)}
          {ex ? `, ${musclesLabel(ex).toLowerCase()}` : ''}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={28} color={colors.text} />
      </View>
      <Text style={s.emptyTitle}>{frenchSpacing(title)}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {children}
    </View>
  );
}

/** Bandeau d'information ou d'alerte, annoncé aux lecteurs d'écran. */
export function Notice({ tone = 'info', title, children, icon }: { tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; children?: ReactNode; icon?: IconName }) {
  const c = { info: colors.cyan, warning: colors.rest, danger: colors.danger, success: colors.accentInk }[tone];
  const ic: IconName = icon ?? { info: 'information-circle', warning: 'warning', danger: 'alert-circle', success: 'checkmark-circle' }[tone] as IconName;
  return (
    <View style={[s.notice, { borderLeftColor: c }]} accessibilityLiveRegion="polite">
      <Ionicons name={ic} size={18} color={c} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        {title ? <Text style={s.noticeTitle}>{title}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  panel: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, overflow: 'hidden' },
  panelSurface: { borderWidth: 1, borderColor: colors.border },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  tagText: { fontSize: 12, fontFamily: font.bold },
  track: { overflow: 'hidden', width: '100%' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: spacing.ms },
  sectionTitle: { color: colors.text, ...type.h2 },
  sectionActionWrap: { paddingVertical: 4, paddingHorizontal: 2 },
  sectionAction: { color: colors.accentInk, fontFamily: font.bold, fontSize: 14 },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  optionSelected: { borderColor: colors.accent, borderWidth: 2, padding: spacing.md - 1 },
  optionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
  optionTitle: { color: colors.text, fontSize: 16, fontFamily: font.bold },
  optionSub: { color: colors.muted, ...type.small, marginTop: 2 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  checkBox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: colors.accent, borderColor: colors.dark },
  fieldLabel: { color: colors.text, fontSize: 14, fontFamily: font.bold },
  field: { minHeight: 48, fontFamily: font.regular, color: colors.text, backgroundColor: colors.card, borderRadius: radius.sm + 2, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16, borderWidth: 1, borderColor: colors.borderStrong },
  fieldFocused: { borderColor: colors.focus, borderWidth: 2, paddingHorizontal: spacing.md - 1, paddingVertical: 11 },
  fieldError: { borderColor: colors.danger },
  fieldMsg: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fieldMsgText: { color: colors.muted, ...type.small },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.ms, paddingVertical: 10 },
  exIndex: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  exIndexText: { color: colors.text, fontFamily: font.black, fontSize: 13, fontVariant: ['tabular-nums'] },
  exName: { color: colors.text, fontFamily: font.bold, fontSize: 15 },
  exMeta: { color: colors.muted, ...type.small, marginTop: 2 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentDim, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  emptyTitle: { color: colors.text, ...type.h3, fontFamily: font.black, textAlign: 'center' },
  emptyText: { color: colors.muted, ...type.body, textAlign: 'center', maxWidth: 320 },
  notice: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, padding: spacing.ms },
  noticeTitle: { color: colors.text, fontFamily: font.black, fontSize: 15 },
});

/** Choix exclusif sur une ligne (onglets internes à un écran). */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  return (
    <View style={seg.wrap} role="tablist" aria-label={label}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            role="tab"
            aria-selected={active}
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync().catch(() => {});
              onChange(o.value);
            }}
            style={(st: PressState) => [seg.item, active && seg.itemActive, !active && st.hovered && { backgroundColor: colors.border }, focusRing(st, radius.pill)]}
          >
            <Text style={[seg.text, active && { color: colors.onAccent }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.pill, padding: 4, gap: 4 },
  item: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill },
  itemActive: { backgroundColor: colors.accent },
  text: { color: colors.muted, fontFamily: font.bold, fontSize: 14 },
});
