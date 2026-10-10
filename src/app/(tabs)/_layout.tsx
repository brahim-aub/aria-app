import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { Colors } from '@/constants/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Accueil', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="exercises" options={{ title: 'Exercices', tabBarIcon: icon('barbell') }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', tabBarIcon: icon('chatbubbles') }} />
      <Tabs.Screen name="progress" options={{ title: 'Progrès', tabBarIcon: icon('trophy') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: icon('person') }} />
    </Tabs>
  );
}
