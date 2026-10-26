import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from './ui';
import { colors, font, spacing } from '@/theme';

export function LocalLoadError({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center', padding: spacing.lg, gap: spacing.md }}>
        <Text style={{ color: colors.text, fontFamily: font.black, fontSize: 24 }} role="heading" aria-level={1}>
          Données locales indisponibles
        </Text>
        <Text style={{ color: colors.text, fontFamily: font.regular, fontSize: 15, lineHeight: 22 }} accessibilityLiveRegion="polite">
          Impossible de lire les données enregistrées sur cet appareil. Pour protéger ta sauvegarde, l’application n’enregistre rien pour le moment.
        </Text>
        <Text style={{ color: colors.muted, fontFamily: font.regular, fontSize: 15, lineHeight: 22 }}>
          Réessaie pour continuer.
        </Text>
        <Button title={retrying ? 'Lecture en cours…' : 'Réessayer'} loading={retrying} disabled={retrying} onPress={onRetry} />
      </View>
    </SafeAreaView>
  );
}

