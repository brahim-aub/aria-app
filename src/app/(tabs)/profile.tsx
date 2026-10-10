import { Link, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Body, Button, Card, Chip, Row, Screen, Title } from '@/components/ui';
import { Colors } from '@/constants/theme';
import { LEVEL_LABELS, ZONE_LABELS } from '@/data/exercises';
import { confirmAction } from '@/lib/confirm';
import { GOAL_LABELS } from '@/lib/labels';
import { computeNutrition } from '@/lib/nutrition';
import { DAY_NAMES, WEEK_ORDER } from '@/lib/week';
import { useAppStore } from '@/store/app-store';

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const testMode = useAppStore((state) => state.testMode);
  const consent = useAppStore((state) => state.consent);
  const voiceEnabled = useAppStore((state) => state.voiceEnabled);
  const setConsent = useAppStore((state) => state.setConsent);
  const setVoiceEnabled = useAppStore((state) => state.setVoiceEnabled);
  const resetAll = useAppStore((state) => state.resetAll);

  if (!profile) return null;

  const nutrition = computeNutrition(profile);
  const days = WEEK_ORDER.filter((day) => profile.trainingDays.includes(day))
    .map((day) => DAY_NAMES[day])
    .join(', ');
  const measurements = [
    profile.age !== null && `${profile.age} ans`,
    profile.heightCm !== null && `${profile.heightCm} cm`,
    profile.weightKg !== null && `${profile.weightKg} kg`,
  ].filter(Boolean);

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
        <Body>Niveau des exercices : {LEVEL_LABELS[profile.level]}</Body>
        {measurements.length > 0 && <Body>{measurements.join(' · ')}</Body>}
        <Body>
          {profile.minutesPerSession} min, le {days || 'jour de ton choix'}
        </Body>
        <Body>
          Zones à ménager :{' '}
          {profile.painZones.length ? profile.painZones.map((z) => ZONE_LABELS[z]).join(', ') : 'aucune'}
        </Body>
        <Body>
          Rappels : {profile.reminderEnabled ? `oui, à ${profile.reminderHour} h` : 'non'}
        </Body>
        <Button label="Modifier mon profil" variant="secondary" onPress={() => router.push('/edit-profile')} />
      </Card>

      <Card>
        <Text style={styles.section}>Mes besoins caloriques</Text>
        {nutrition ? (
          <>
            <Body>
              Pour ton objectif : <Text style={styles.highlight}>{nutrition.target} kcal par jour</Text>
            </Body>
            <Body muted>Maintien de ton poids : {nutrition.maintenance} kcal</Body>
            <Body>
              Protéines {nutrition.proteinG} g · Lipides {nutrition.fatG} g · Glucides{' '}
              {nutrition.carbsG} g
            </Body>
            <Body muted>
              Estimation à partir de ton âge, ta taille, ton poids et ton activité. Ce n&apos;est pas
              un avis médical.
            </Body>
          </>
        ) : (
          <>
            <Body muted>
              Renseigne ton âge, ton sexe, ta taille et ton poids pour obtenir une estimation. Ces
              infos sont facultatives et restent sur ton téléphone.
            </Body>
            <Button label="Compléter" variant="secondary" onPress={() => router.push('/edit-profile')} />
          </>
        )}
      </Card>

      <Card>
        <Text style={styles.section}>Séance guidée</Text>
        <Body muted>Le coach annonce les exercices et le décompte à voix haute.</Body>
        <Row>
          <Chip label="Voix activée" selected={voiceEnabled} onPress={() => setVoiceEnabled(true)} />
          <Chip label="Sans voix" selected={!voiceEnabled} onPress={() => setVoiceEnabled(false)} />
        </Row>
      </Card>

      <Card>
        <Text style={styles.section}>Mes données</Text>
        <Body>
          Tu utilises Aria sans compte : tout est gardé sur ce téléphone. La création de compte
          arrivera pour sauvegarder ta progression et débloquer les succès.
        </Body>
        {testMode && <Body muted>Mode test actif : toutes les fonctionnalités sont débloquées.</Body>}
        <Body muted>Statistiques d&apos;usage anonymes pour améliorer l&apos;appli :</Body>
        <Row>
          <Chip label="J'accepte" selected={consent.analytics} onPress={() => setConsent({ analytics: true })} />
          <Chip label="Non merci" selected={!consent.analytics} onPress={() => setConsent({ analytics: false })} />
        </Row>
        <Link href="/privacy" style={styles.link}>
          Politique de confidentialité ›
        </Link>
        <Link href="/feedback" style={styles.link}>
          Donner mon avis ›
        </Link>
      </Card>

      <Button label="Refaire l'onboarding" variant="secondary" onPress={() => router.push('/onboarding')} />
      <Button label="Tout effacer" variant="ghost" onPress={confirmReset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 18, fontWeight: '600', color: Colors.text },
  highlight: { fontWeight: '700', color: Colors.text },
  link: { fontSize: 16, fontWeight: '600', color: Colors.text, paddingVertical: 4 },
});
