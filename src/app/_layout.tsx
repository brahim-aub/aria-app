import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans/800ExtraBold';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors, Fonts } from '@/constants/theme';
import { useAppStore, useHasHydrated } from '@/store/app-store';

SplashScreen.preventAutoHideAsync();

const withHeader = {
  headerShown: true,
  headerShadowVisible: false,
  headerStyle: { backgroundColor: Colors.background },
  headerTintColor: Colors.text,
  headerTitleStyle: { fontFamily: Fonts.bold, fontSize: 17 },
};

export default function RootLayout() {
  const hasHydrated = useHasHydrated();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  // Si la police ne se charge pas, on affiche quand même l'appli avec la police du système.
  const ready = hasHydrated && (fontsLoaded || Boolean(fontError));

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync();
    useAppStore.getState().track('app_open');
  }, [ready]);

  // On attend que les données stockées sur le téléphone soient chargées avant d'afficher l'appli.
  if (!ready) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Screen
          name="session"
          options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: Colors.ink } }}
        />
        <Stack.Screen name="exercise/[id]" options={{ ...withHeader, title: '' }} />
        <Stack.Screen name="edit-session" options={{ ...withHeader, title: 'Modifier ma séance' }} />
        <Stack.Screen name="edit-profile" options={{ ...withHeader, title: 'Mon profil' }} />
        <Stack.Screen name="privacy" options={{ ...withHeader, title: 'Confidentialité' }} />
        <Stack.Screen name="feedback" options={{ ...withHeader, title: 'Donner mon avis' }} />
      </Stack>
    </>
  );
}
