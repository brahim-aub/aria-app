import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { IconName } from '@/components/ui';
import { focusRing, PressState } from '@/lib/motion';
import { colors, floating, font, radius, spacing } from '@/theme';

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Accueil', icon: 'home-outline', iconActive: 'home' },
  { name: 'programme', title: 'Programme', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'coach', title: 'Coach', icon: 'sparkles-outline', iconActive: 'sparkles' },
  { name: 'nutrition', title: 'Nutrition', icon: 'nutrition-outline', iconActive: 'nutrition' },
  { name: 'profil', title: 'Profil', icon: 'person-outline', iconActive: 'person' },
];

/** Barre flottante encre ; chaque onglet garde son nom, l'actif est surligné en citron. */
function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.bar} role="tablist">
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const focused = index === state.index;
          return (
            <Pressable
              key={route.key}
              role="tab"
              aria-selected={focused}
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.title}
              onPress={() => {
                const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync().catch(() => {});
                  navigateToTab(route.key);
                }
              }}
              onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
              style={(s: PressState) => [styles.item, focused && styles.itemActive, !focused && s.hovered && { backgroundColor: colors.darkAlt }, focusRing(s, radius.pill, colors.accent)]}
            >
              <Ionicons name={focused ? tab.iconActive : tab.icon} size={20} color={focused ? colors.onAccent : colors.onDarkMuted} />
              <Text
                style={[styles.label, { color: focused ? colors.onAccent : colors.onDarkMuted }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {tab.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.bg, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  bar: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    padding: 4,
    ...floating,
  },
  item: { flex: 1, minWidth: 0, minHeight: 58, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 0, paddingVertical: 6 },
  itemActive: { backgroundColor: colors.accent },
  label: { alignSelf: 'stretch', textAlign: 'center', fontFamily: font.black, fontSize: 11, lineHeight: 14 },
});
