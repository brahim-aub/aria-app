import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Notice } from './kit';
import { Button } from './ui';
import { colors, font, layout, spacing } from '@/theme';

export function LocalSaveNotice({ visible, retrying, onRetry }: {
  visible: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (!visible) return null;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.sm, width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' }}>
        <Notice tone="warning" title="Sauvegarde sur cet appareil impossible">
          <Text style={{ color: colors.text, fontFamily: font.regular, fontSize: 14, lineHeight: 20 }}>
            Certaines modifications n’ont pas pu être enregistrées sur cet appareil. Garde l’application ouverte et réessaie.
          </Text>
          <Button title={retrying ? 'Enregistrement…' : 'Réessayer'} variant="secondary" loading={retrying} disabled={retrying} onPress={onRetry} />
        </Notice>
      </View>
    </SafeAreaView>
  );
}

