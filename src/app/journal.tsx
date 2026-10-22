import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/kit';
import { Button, Card, difficultyLabel, energyLabel, IconButton, Muted, Screen } from '@/components/ui';
import { confirmAction } from '@/lib/confirm';
import { formatDate } from '@/lib/date';
import { LogEntry, useApp } from '@/store/AppStore';
import { colors, font, radius, spacing, type } from '@/theme';

export default function Journal() {
  const { data, deleteLog } = useApp();

  const confirmDelete = (l: LogEntry) =>
    void confirmAction('Supprimer cette séance ?', `${l.title}, ${formatDate(l.date)}.`, 'Supprimer', true).then((ok) => {
      if (ok) deleteLog(l.id);
    });

  return (
    <Screen top={false}>
      <Button title="Ajouter une activité libre" icon="add" variant="secondary" onPress={() => router.push('/ajout-seance')} />

      {data.logs.length === 0 ? (
        <Card>
          <EmptyState icon="book-outline" title="Aucune séance pour l’instant" text="Lance ta première séance du programme, ou ajoute une activité faite à côté : marche, vélo, natation…" />
        </Card>
      ) : (
        <>
          {data.logs.map((l) => (
            <View key={l.id}>
              <Card>
                <View style={styles.rowTop}>
                  <View style={[styles.icon, l.kind === 'program' && { backgroundColor: colors.accentDim }]}>
                    <Ionicons name={l.kind === 'program' ? 'barbell-outline' : 'walk-outline'} size={18} color={colors.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{l.title}</Text>
                    <Text style={styles.date}>
                      {formatDate(l.date)}, {l.durationMin} min
                    </Text>
                  </View>
                  <IconButton icon="trash-outline" plain size={20} color={colors.muted} label={`Supprimer la séance ${l.title} du ${formatDate(l.date)}`} onPress={() => confirmDelete(l)} />
                </View>
                <View style={styles.tags}>
                  <Tag label={`Difficulté : ${difficultyLabel(l.difficulty)}`} />
                  <Tag label={`Énergie : ${energyLabel(l.energy)}`} />
                </View>
                {l.note && <Muted>« {l.note} »</Muted>}
              </Card>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontFamily: font.black, fontSize: 16 },
  date: { color: colors.muted, ...type.small, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { backgroundColor: colors.cardAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { color: colors.muted, fontSize: 12, fontFamily: font.bold },
});
