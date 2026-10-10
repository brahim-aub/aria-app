import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { useAppStore, useHasHydrated } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

const withHeader = {
  headerShown: true,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.text,
};

export default function RootLayout() {
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (!hasHydrated) return;
    SplashScreen.hideAsync();
    useAppStore.getState().track('app_open');
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
        <Stack.Screen name="exercise/[id]" options={{ ...withHeader, title: '' }} />
        <Stack.Screen name="edit-session" options={{ ...withHeader, title: 'Modifier ma séance' }} />
        <Stack.Screen name="edit-profile" options={{ ...withHeader, title: 'Mon profil' }} />
        <Stack.Screen name="privacy" options={{ ...withHeader, title: 'Confidentialité' }} />
        <Stack.Screen name="feedback" options={{ ...withHeader, title: 'Donner mon avis' }} />
      </Stack>
    </>
  );
}
