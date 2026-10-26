import { Lato_400Regular, Lato_700Bold, Lato_900Black, useFonts } from '@expo-google-fonts/lato';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogHost } from '@/components/DialogHost';
import { AchievementToast } from '@/components/AchievementToast';
import { Button } from '@/components/ui';
import { LocalSaveNotice } from '@/components/LocalSaveNotice';
import { LocalLoadError } from '@/components/LocalLoadError';
import { setupNotificationHandler, useReminderSync } from '@/lib/notifications';
import { AppProvider, useApp } from '@/store/AppStore';
import { AuthProvider, useAuth } from '@/store/AuthStore';
import { SessionDraftProvider } from '@/store/SessionDraftStore';
import { colors, font, radius, spacing } from '@/theme';

setupNotificationHandler();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.bg, primary: colors.accent, text: colors.text, border: colors.border },
};

function RootStack() {
  const { ready, data, localSaveFailed, retryingLocalSave, retryLocalSave, localLoadFailed, retryingLocalLoad, retryLocalLoad } = useApp();
  const auth = useAuth();
  const [fontsLoaded, fontError] = useFonts({ Lato_400Regular, Lato_700Bold, Lato_900Black });
  // Rappels actifs seulement pour un utilisateur connecté (ou en mode local) dont les données sont à jour.
  const remindersActive = ready && auth.ready && (!auth.enabled || !!auth.session) && auth.sync.status !== 'pulling' && auth.sync.status !== 'choice';
  useReminderSync(data, remindersActive);
  if (localLoadFailed) return <LocalLoadError retrying={retryingLocalLoad} onRetry={() => { void retryLocalLoad(); }} />;
  if (!ready || !auth.ready || (!fontsLoaded && !fontError)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accentInk} />
      </View>
    );
  }
  const signedIn = !auth.enabled || !!auth.session;
  const onboarded = signedIn && data.profile.onboarded;
  return (
    <View style={{ flex: 1 }}>
      <LocalSaveNotice visible={localSaveFailed} retrying={retryingLocalSave} onRetry={() => { void retryLocalSave(); }} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: font.black },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="confidentialite" options={{ title: 'Confidentialité' }} />
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="connexion" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="seance/[id]" options={{ headerShown: false, gestureEnabled: false, animation: 'slide_from_bottom' }} />
          <Stack.Screen name="seances" options={{ title: 'Séances' }} />
          <Stack.Screen name="creer-seance" options={{ title: 'Créer une séance' }} />
          <Stack.Screen name="exercices" options={{ title: 'Exercices' }} />
          <Stack.Screen name="trophees" options={{ title: 'Succès' }} />
          <Stack.Screen name="progres" options={{ title: 'Progrès' }} />
          <Stack.Screen name="journal" options={{ title: 'Journal' }} />
          <Stack.Screen name="chrono" options={{ title: 'Chrono' }} />
          <Stack.Screen name="ajout-seance" options={{ title: 'Activité libre', presentation: 'modal' }} />
          <Stack.Screen name="preferences-repas" options={{ title: 'Mes goûts', presentation: 'modal' }} />
          <Stack.Screen name="reglages" options={{ title: 'Réglages' }} />
        </Stack.Protected>
      </Stack>
      {onboarded && <AchievementToast />}
      <DialogHost />
      {/* Par-dessus la navigation (et non à sa place) : le navigateur doit rester monté pendant les changements d'écran. */}
      {auth.sync.status === 'pulling' && (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.accentInk} />
          <Text style={styles.overlayText}>Récupération de tes données…</Text>
        </View>
      )}
      {auth.sync.status === 'choice' && <ImportChoice onChoose={auth.resolveImport} />}
    </View>
  );
}

function ImportChoice({ onChoose }: { onChoose: (keepPhoneData: boolean) => void }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.choice}>
        <Text style={styles.choiceTitle} role="heading" aria-level={1}>
          Ton compte est tout neuf
        </Text>
        <Text style={styles.choiceText}>Ce téléphone contient déjà un programme, des séances et des succès. Tu veux les garder sur ton compte ?</Text>
        <Button title="Garder les données de ce téléphone" icon="cloud-upload-outline" onPress={() => onChoose(true)} />
        <Button title="Repartir de zéro" variant="secondary" icon="sparkles-outline" onPress={() => onChoose(false)} />
      </View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider value={theme}>
        <AppProvider>
          <AuthProvider>
            <SessionDraftProvider>
              <StatusBar style="dark" />
              <RootStack />
            </SessionDraftProvider>
          </AuthProvider>
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.md },
  overlayText: { color: colors.muted, fontFamily: font.bold, fontSize: 14 },
  choice: { alignSelf: 'center', width: '100%', maxWidth: 480, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  choiceTitle: { color: colors.text, fontFamily: font.black, fontSize: 22 },
  choiceText: { color: colors.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
});
