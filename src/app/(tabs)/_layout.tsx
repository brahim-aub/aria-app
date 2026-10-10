import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { IconName } from '@/components/ui';
import { Colors, Fonts } from '@/constants/theme';

/** Icône d'onglet : pleine et posée sur une pastille verte quand l'onglet est actif. */
function icon(name: IconName, outline: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View style={[styles.pill, focused && styles.pillActive]}>
        <Ionicons
          name={focused ? name : outline}
          size={21}
          color={focused ? Colors.ink : Colors.textSecondary}
        />
      </View>
    );
  };
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.ink,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [styles.bar, { height: 76 + insets.bottom, paddingBottom: 12 + insets.bottom }],
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen
        name="exercises"
        options={{ title: 'Exercices', tabBarIcon: icon('barbell', 'barbell-outline') }}
      />
      <Tabs.Screen
        name="coach"
        options={{ title: 'Coach', tabBarIcon: icon('chatbubbles', 'chatbubbles-outline') }}
      />
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progrès', tabBarIcon: icon('trophy', 'trophy-outline') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person', 'person-outline') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.card,
    borderTopWidth: 0,
    paddingTop: 8,
    boxShadow: '0px -4px 20px rgba(14, 15, 18, 0.05)',
  },
  label: { fontFamily: Fonts.semibold, fontSize: 11, marginTop: 4 },
  pill: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: Colors.accent },
});
