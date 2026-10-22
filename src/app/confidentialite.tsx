import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, font, spacing } from '@/theme';

/**
 * Politique de confidentialité (brouillon à faire relire avant publication).
 * Le Play Store demande aussi cette page à une adresse web publique.
 */
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Qui est responsable ?',
    body: ['Aria Sport est édité par un développeur indépendant. Contact : à compléter avant la publication.'],
  },
  {
    title: 'Quelles données ?',
    body: [
      'Ton profil : prénom, âge, taille, poids, objectif, niveau, matériel, rythme.',
      'Tes séances, pesées, succès et ta conversation avec le coach.',
      'Les douleurs ou blessures que tu signales : ce sont des données de santé.',
      'Tes préférences alimentaires, allergies et menus.',
      'Ton adresse e-mail, si tu crées un compte.',
    ],
  },
  {
    title: 'Où sont-elles enregistrées ?',
    body: [
      'Sur ton téléphone.',
      'Si tu crées un compte : chez Supabase, dans un centre de données en Irlande (Union européenne). Chaque compte ne peut lire que ses propres données.',
    ],
  },
  {
    title: 'Le coach IA (Google Gemini)',
    body: [
      'Quand tu écris au coach, quand il crée tes menus ou cherche des prix, ton message et le contexte utile (profil, planning, douleurs, préférences) sont envoyés à Google (API Gemini), qui peut les traiter hors de l’Union européenne.',
      'Ces envois n’ont lieu qu’après ton accord, que tu peux retirer à tout moment dans les réglages : le coach est alors désactivé.',
    ],
  },
  {
    title: 'Ce que nous ne faisons pas',
    body: ['Pas de publicité, pas de revente de données, pas de traqueur publicitaire.', 'Le coach ne pose pas de diagnostic médical : en cas de douleur vive ou persistante, consulte un professionnel de santé.'],
  },
  {
    title: 'Combien de temps ?',
    body: ['Tant que ton compte existe. La suppression du compte (Réglages > Mon compte) efface immédiatement toutes tes données enregistrées.'],
  },
  {
    title: 'Tes droits',
    body: [
      'Accès, rectification, effacement, portabilité, retrait du consentement : depuis l’app (Réglages) ou en écrivant au contact ci-dessus.',
      'Tu peux aussi saisir la CNIL (cnil.fr).',
    ],
  },
];

export default function Confidentialite() {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.content}>
      <View style={styles.column}>
      <Text style={styles.intro}>Version du 22 octobre 2026.</Text>
      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text style={styles.title} role="heading" aria-level={2}>
            {s.title}
          </Text>
          {s.body.map((p, i) => (
            <Text key={i} style={styles.body}>
              {s.body.length > 1 ? '• ' : ''}
              {p}
            </Text>
          ))}
        </View>
      ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  column: { width: '100%', maxWidth: 640, alignSelf: 'center', gap: spacing.lg },
  intro: { color: colors.muted, fontFamily: font.regular, fontSize: 13 },
  section: { gap: spacing.sm },
  title: { color: colors.text, fontFamily: font.black, fontSize: 17 },
  body: { color: colors.text, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
});
