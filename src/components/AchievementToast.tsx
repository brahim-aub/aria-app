import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';

import { ACHIEVEMENTS, TIER_COLOR, TIER_LABEL, TIER_POINTS } from '@/data/achievements';
import { useReducedMotion } from '@/lib/motion';
import { useApp } from '@/store/AppStore';
import { colors, radius, spacing, font } from '@/theme';

import { Button } from './ui';

/** Grande carte de célébration quand un succès est débloqué. */
export function AchievementToast() {
  const { unlocked, dismissUnlocked } = useApp();
  const id = unlocked[0];
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  const [scale] = useState(() => new Animated.Value(0.6));
  const [spin] = useState(() => new Animated.Value(0));
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!a) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (reduced) {
      scale.setValue(1);
      spin.setValue(1);
      return;
    }
    scale.setValue(0.6);
    spin.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
    ]).start();
  }, [a, scale, spin, reduced]);

  if (!a) return null;
  const color = TIER_COLOR[a.tier];
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '0deg'] });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismissUnlocked}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]} accessibilityViewIsModal accessibilityLiveRegion="assertive">
          <Text style={[styles.kicker, { color }]}>Succès débloqué</Text>
          <Animated.View style={[styles.medal, { backgroundColor: color + '17', borderColor: color, transform: [{ rotate }] }]}>
            <Ionicons name={a.icon} size={56} color={color} />
          </Animated.View>
          <Text style={styles.title}>{a.title}</Text>
          <Text style={styles.desc}>{a.description}</Text>
          <View style={[styles.points, { backgroundColor: color + '17' }]}>
            <Text style={[styles.pointsText, { color }]}>
              {TIER_LABEL[a.tier]}, +{TIER_POINTS[a.tier]} points
            </Text>
          </View>
          {unlocked.length > 1 && <Text style={styles.more}>+{unlocked.length - 1} autre(s) succès</Text>}
          <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.sm }}>
            <Button title="Continuer" onPress={dismissUnlocked} />
            <Button
              title="Voir mes succès"
              variant="ghost"
              onPress={() => {
                dismissUnlocked();
                router.push('/trophees');
              }}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(25, 33, 38, 0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  kicker: { fontFamily: font.black, fontSize: 15 },
  medal: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontFamily: font.black, textAlign: 'center' },
  desc: { fontFamily: font.regular, color: colors.muted, fontSize: 15, textAlign: 'center' },
  points: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, marginTop: spacing.xs },
  pointsText: { fontFamily: font.black },
  more: { fontFamily: font.regular, color: colors.muted, fontSize: 12 },
});
