import { StyleSheet, Text } from 'react-native';

import { Body, Card, Screen } from '@/components/ui';
import { Colors, Fonts } from '@/constants/theme';

/**
 * Version provisoire de la politique de confidentialité. Le Play Store demandera la même page
 * hébergée sur une adresse web publique avant la publication.
 */
const SECTIONS = [
  {
    title: 'Ce que l\'appli enregistre',
    body: 'Ton prénom, ton objectif, ton niveau, tes jours d\'entraînement, les zones que tu veux ménager, tes séances terminées et, si tu les donnes, ton âge, ton sexe, ta taille et ton poids.',
  },
  {
    title: 'Où sont tes données',
    body: 'Uniquement sur ton téléphone. Aria n\'a pas encore de comptes ni de serveur : rien n\'est envoyé sur internet. Si tu désinstalles l\'appli, tout est supprimé.',
  },
  {
    title: 'Données de santé',
    body: 'Tes douleurs et tes mensurations servent seulement à adapter les séances et à estimer tes besoins caloriques. Elles ne sont ni vendues ni partagées.',
  },
  {
    title: 'Statistiques d\'usage',
    body: 'Si tu l\'acceptes, l\'appli note des événements anonymes (séance terminée, ressenti donné) pour nous aider à l\'améliorer. Tu peux changer d\'avis à tout moment dans ton profil.',
  },
  {
    title: 'Tes droits',
    body: 'Tu peux modifier tes informations depuis ton profil, ou tout effacer avec le bouton « Tout effacer ». Pour toute question, écris-nous depuis « Donner mon avis ».',
  },
  {
    title: 'Avis important',
    body: 'Aria propose des exercices généraux et ne remplace pas un avis médical. En cas de douleur, de malaise ou de doute, arrête et consulte un professionnel de santé.',
  },
];

export default function Privacy() {
  return (
    <Screen edges={['bottom']}>
      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <Text style={styles.section}>{section.title}</Text>
          <Body>{section.body}</Body>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.text },
});
