import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Body, Button, Card, Screen, Title } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { ZONE_LABELS } from '@/data/exercises';
import { confirmAction } from '@/lib/confirm';
import { computeNutrition } from '@/lib/nutrition';
import type { Goal } from '@/lib/types';
import { useAppStore } from '@/store/app-store';

const GOAL_LABELS: Record<Goal, string> = {
  perte_poids: 'Perdre du poids',
  muscle: 'Prendre du muscle',
  forme: 'Être en forme',
  souplesse: 'Gagner en souplesse',
  reprise: 'Me remettre au sport',
};

const LEVEL_LABELS = { 1: 'Débutant', 2: 'Intermédiaire', 3: 'Régulier' } as const;

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const testMode = useAppStore((state) => state.testMode);
  const resetAll = useAppStore((state) => state.resetAll);

  if (!profile) return null;

  const nutrition = computeNutrition(profile);

  const confirmReset = () =>
    confirmAction(
      'Tout effacer ?',
      'Ton profil, tes séances et ta progression seront supprimés de ce téléphone.',
      'Effacer',
      () => {
        resetAll();
        router.replace('/onboarding');
      },
    );

  return (
    <Screen>
      <Title>{profile.firstName}</Title>

      <Card>
        <Text style={styles.section}>Mon profil</Text>
        <Body>Objectif : {GOAL_LABELS[profile.goal]}</Body>
        <Body>Niveau : {LEVEL_LABELS[profile.level]}</Body>
        <Body>
          {profile.age} ans · {profile.heightCm} cm · {profile.weightKg} kg
        </Body>
        <Body>
          {profile.daysPerWeek} séances par semaine · {profile.minutesPerSession} min
        </Body>
        <Body>
          Zones à ménager :{' '}
          {profile.painZones.length ? profile.painZones.map((z) => ZONE_LABELS[z]).join(', ') : 'aucune'}
        </Body>
      </Card>

      <Card>
        <Text style={styles.section}>Mes besoins caloriques</Text>
        <Body>
          Pour ton objectif : <Text style={styles.highlight}>{nutrition.target} kcal par jour</Text>
        </Body>
        <Body muted>Maintien de ton poids : {nutrition.maintenance} kcal</Body>
        <Body>
          Protéines {nutrition.proteinG} g · Lipides {nutrition.fatG} g · Glucides {nutrition.carbsG} g
        </Body>
        <Body muted>
          Estimation à partir de ton âge, ta taille, ton poids et ton activité. Ce n&apos;est pas un
          avis médical.
        </Body>
      </Card>

      <Card>
        <Text style={styles.section}>Compte</Text>
        <Body>
          Tu utilises Aria sans compte : tout est gardé sur ce téléphone. La création de compte
          arrivera pour sauvegarder ta progression et débloquer les succès.
        </Body>
        {testMode && <Body muted>Mode test actif : toutes les fonctionnalités sont débloquées.</Body>}
      </Card>

      <Button label="Refaire l'onboarding" variant="secondary" onPress={() => router.push('/onboarding')} />
      <Button label="Tout effacer" variant="ghost" onPress={confirmReset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: '800', color: Colors.text },
  highlight: { fontWeight: '800', color: Colors.primaryDark },
});
