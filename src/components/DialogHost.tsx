import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { DialogRequest, setDialogHost } from '@/lib/confirm';
import { colors, radius, spacing, type } from '@/theme';

import { Button } from './ui';

/** Boîte de confirmation dessinée par l'app (web) : remplace window.confirm, souvent bloqué. */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const current = queue[0];

  useEffect(() => {
    setDialogHost((req) => setQueue((q) => [...q, req]));
    return () => setDialogHost(null);
  }, []);

  const close = (ok: boolean) => {
    current?.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  return (
    <Modal transparent visible={!!current} animationType="fade" onRequestClose={() => close(false)}>
      <Pressable style={styles.backdrop} onPress={() => close(false)} accessibilityLabel="Fermer">
        <Pressable style={styles.card} accessibilityViewIsModal role="alertdialog" aria-label={current?.title}>
          <Text style={styles.title} role="heading" aria-level={2}>
            {current?.title}
          </Text>
          {current?.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={styles.actions}>
            {current?.confirmLabel ? (
              <>
                <Button title="Annuler" variant="secondary" style={{ flex: 1 }} onPress={() => close(false)} />
                <Button title={current.confirmLabel} variant={current.destructive ? 'danger' : 'primary'} style={{ flex: 1 }} onPress={() => close(true)} />
              </>
            ) : (
              <Button title="OK" style={{ flex: 1 }} onPress={() => close(true)} />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(25, 33, 38, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  card: { width: '100%', maxWidth: 420, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.ms },
  title: { color: colors.text, ...type.h2 },
  message: { color: colors.muted, ...type.body },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
});
