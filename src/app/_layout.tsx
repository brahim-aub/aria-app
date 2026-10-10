import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { useAppStore } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  useEffect(() => {
    if (hasHydrated) SplashScreen.hideAsync();
  }, [hasHydrated]);

  // On attend que les données stockées sur le téléphone soient chargées avant d'afficher l'appli.
  if (!hasHydrated) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Screen name="session" options={{ presentation: 'fullScreenModal' }} />
        <Stack.Screen
          name="exercise/[id]"
          options={{ headerShown: true, title: '', headerShadowVisible: false }}
        />
      </Stack>
    </>
  );
}
