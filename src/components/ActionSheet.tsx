import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { focusRing, PressState } from '@/lib/motion';
import { colors, font, radius, spacing } from '@/theme';

import type { IconName } from './ui';

export type SheetOption = { label: string; icon: IconName; onPress: () => void; destructive?: boolean; color?: string };

/** Petite feuille d'actions en bas de l'écran (Android limite Alert à 3 boutons). */
export function useActionSheet(): { open: (title: string, options: SheetOption[]) => void; element: ReactNode } {
  const [state, setState] = useState<{ title: string; options: SheetOption[] } | null>(null);
  const insets = useSafeAreaInsets();
  const open = useCallback((title: string, options: SheetOption[]) => setState({ title, options }), []);
  const close = () => setState(null);

  const element = (
    <Modal transparent visible={!!state} animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Fermer le menu">
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]} accessibilityViewIsModal>
          <View style={styles.handle} />
          {state?.title ? (
            <Text style={styles.title} role="heading" aria-level={2}>
              {state.title}
            </Text>
          ) : null}
          {state?.options.map((o) => (
            <Pressable
              key={o.label}
              accessibilityRole="button"
              style={(s: PressState) => [styles.option, (s.pressed || s.hovered) && { backgroundColor: colors.bg }, focusRing(s, radius.sm)]}
              onPress={() => {
                close();
                o.onPress();
              }}
            >
              <Ionicons name={o.icon} size={20} color={o.destructive ? colors.danger : colors.text} />
              <Text style={[styles.optionText, o.destructive && { color: colors.danger }]}>{o.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={close} style={(s: PressState) => [styles.option, styles.cancel, focusRing(s, radius.sm)]}>
            <Text style={[styles.optionText, { color: colors.muted }]}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
  return { open, element };
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(25, 33, 38, 0.55)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md, gap: 2 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.sm },
  title: { color: colors.text, fontFamily: font.black, fontSize: 17, marginBottom: spacing.xs, paddingHorizontal: spacing.sm },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  cancel: { justifyContent: 'center', marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, borderRadius: 0 },
  optionText: { color: colors.text, fontSize: 16, fontFamily: font.bold },
});
