import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, spacing } from '@/theme';
import { focusRing, PressState, pressFeedback } from '@/lib/motion';

export const BRAND = { name: 'Mova', tagline: 'À ton rythme. Pour de vrai.' };
export const imagery = {
  training: require('../../assets/mova/training.png'),
  lower: require('../../assets/mova/lower.png'),
  cardio: require('../../assets/mova/cardio.png'),
  core: require('../../assets/mova/core.png'),
  mobility: require('../../assets/mova/mobility.png'),
  nutrition: require('../../assets/mova/nutrition.png'),
};

/** Visuel d'ambiance par famille ; les titres personnalisés inconnus gardent l'image générale. */
export function workoutImage(title: string): keyof typeof imagery {
  const name = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/mobilite|souplesse|recuperation|etirement|yoga|reveil/.test(name)) return 'mobility';
  if (/bas du corps|jambes|fessiers|legs/.test(name)) return 'lower';
  if (/abdos|abdomin|gainage|core/.test(name)) return 'core';
  if (/cardio|hiit|express|course/.test(name)) return 'cardio';
  return 'training';
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
    <View style={{ flexDirection: 'row', gap: size * 0.06 }}>
      {[0, 1, 2].map((i) => <View key={i} style={{ width: size * 0.13, height: size * (i === 1 ? 0.31 : 0.49), backgroundColor: colors.onAccent, borderRadius: 2, transform: [{ skewX: '-18deg' }], marginTop: i === 1 ? size * 0.18 : 0 }} />)}
    </View>
  </View>;
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }} accessibilityLabel="Mova">
    <BrandMark size={compact ? 28 : 36} />
    <Text style={{ color: colors.text, fontFamily: font.black, fontSize: compact ? 23 : 30, letterSpacing: -1 }}>mova<Text style={{ color: colors.accent }}>.</Text></Text>
  </View>;
}

export function EditorialCard({ title, subtitle, kicker, image = 'training', onPress, action, children }: {
  title: string; subtitle?: string; kicker: string; image?: keyof typeof imagery; onPress?: () => void; action?: string; children?: ReactNode;
}) {
  const content = <>
    <Image source={imagery[image]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="center" accessible={false} />
    <LinearGradient colors={['rgba(9,12,9,0.05)', 'rgba(9,12,9,0.3)', 'rgba(9,12,9,0.97)']} locations={[0, 0.35, 1]} style={StyleSheet.absoluteFill} />
    <View style={s.photoTop}><Text style={s.eyebrow}>{kicker}</Text><Ionicons name={image === 'nutrition' ? 'restaurant-outline' : 'barbell-outline'} size={19} color={colors.onDark} /></View>
    <View style={s.photoBottom}>
      <Text style={s.title}>{title}</Text>
      {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {children}
      {action && <View style={s.actionRow}><Text style={s.actionText}>{action}</Text><View style={s.arrow}><Ionicons name="arrow-forward" size={21} color={colors.onAccent} /></View></View>}
    </View>
  </>;
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={action ? action + ' : ' + title : title} style={(state: PressState) => [s.photo, pressFeedback(state, 0.99), focusRing(state, radius.lg)]}>{content}</Pressable> : <View style={s.photo}>{content}</View>;
}
const s = StyleSheet.create({
  photo: { minHeight: 270, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.cardAlt, justifyContent: 'space-between' },
  photoTop: { padding: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: colors.onDark, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase' },
  photoBottom: { padding: spacing.lg, paddingTop: spacing.xl, gap: 8 },
  title: { color: colors.onDark, fontFamily: font.black, fontSize: 30, lineHeight: 34, letterSpacing: -0.6, maxWidth: '90%' },
  subtitle: { color: '#CED2C7', fontFamily: font.regular, fontSize: 14, lineHeight: 20, maxWidth: '88%' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  actionText: { color: colors.accent, fontFamily: font.bold, fontSize: 14 },
  arrow: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
