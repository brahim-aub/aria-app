import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Body, Card, Heading, Row, Screen, Title } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const EXAMPLES = [
  'J\'ai mal au genou',
  'Je n\'ai que 15 minutes',
  'Explique-moi la planche',
  'Une séance sans bruit',
];

export default function Coach() {
  return (
    <Screen>
      <View style={styles.header}>
        <Title>Ton coach</Title>
        <Badge tone="accent" icon="sparkles" label="Bientôt" />
      </View>

      <Card variant="dark" style={styles.hero}>
        <View style={[styles.bubble, styles.user]}>
          <Text style={styles.userText}>J&apos;ai mal au genou aujourd&apos;hui.</Text>
        </View>
        <View style={styles.coachRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View style={[styles.bubble, styles.coach]}>
            <Text style={styles.coachText}>
              Pas de souci. Je remplace les squats par du gainage et des étirements doux. Ta séance
              fait 18 minutes, on y va ?
            </Text>
          </View>
        </View>
      </Card>

      <Body>
        Bientôt, tu pourras discuter ici avec ton coach. Il connaîtra ton profil et ta progression,
        et te proposera une séance adaptée à valider d&apos;un tap.
      </Body>

      <Heading>Tu pourras lui dire</Heading>
      <Row>
        {EXAMPLES.map((example) => (
          <View key={example} style={styles.example}>
            <Text style={styles.exampleText}>« {example} »</Text>
          </View>
        ))}
      </Row>

      <Card variant="soft" style={styles.note}>
        <Ionicons name="cloud-offline-outline" size={20} color={Colors.textSecondary} />
        <Body muted style={styles.noteText}>
          En attendant, adapte ta séance depuis l&apos;accueil. Le coach aura besoin d&apos;internet ;
          tout le reste de l&apos;appli fonctionne sans.
        </Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
  hero: { padding: Spacing.lg, gap: Spacing.md },
  bubble: { maxWidth: '85%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20 },
  user: { alignSelf: 'flex-end', backgroundColor: Colors.accent, borderBottomRightRadius: 6 },
  userText: { fontSize: 15, lineHeight: 21, fontFamily: Fonts.semibold, color: Colors.ink },
  coachRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontFamily: Fonts.extrabold, color: Colors.ink },
  coach: { flexShrink: 1, backgroundColor: Colors.inkSoft, borderTopLeftRadius: 6 },
  coachText: { fontSize: 15, lineHeight: 21, fontFamily: Fonts.regular, color: Colors.white },
  example: {
    backgroundColor: Colors.card,
    borderRadius: Radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  exampleText: { fontSize: 14, fontFamily: Fonts.medium, color: Colors.text },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
