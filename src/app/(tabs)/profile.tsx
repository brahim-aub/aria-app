import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Body,
  Button,
  Card,
  Chip,
  Heading,
  IconTile,
  type IconName,
  Row,
  Screen,
} from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { LEVEL_LABELS, ZONE_LABELS } from '@/data/exercises';
import { confirmAction } from '@/lib/confirm';
import { GOAL_LABELS } from '@/lib/labels';
import { computeNutrition } from '@/lib/nutrition';
import { DAY_SHORT, WEEK_ORDER } from '@/lib/week';
import { useAppStore } from '@/store/app-store';

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <IconTile icon={icon} size={36} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function LinkRow({ href, icon, label }: { href: '/privacy' | '/feedback'; icon: IconName; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.infoRow}>
        <IconTile icon={icon} size={36} />
        <Text style={[styles.infoLabel, styles.flex]}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
      </Pressable>
    </Link>
  );
}

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
    .map((day) => DAY_SHORT[day])
    .join(', ');
  const measurements = [
    profile.age !== null && `${profile.age} ans`,
    profile.heightCm !== null && `${profile.heightCm} cm`,
    profile.weightKg !== null && `${profile.weightKg} kg`,
  ].filter(Boolean);

  const macros = nutrition
    ? [
        { label: 'Protéines', grams: nutrition.proteinG, kcal: nutrition.proteinG * 4, color: '#5B45E0' },
        { label: 'Lipides', grams: nutrition.fatG, kcal: nutrition.fatG * 9, color: '#D9561C' },
        { label: 'Glucides', grams: nutrition.carbsG, kcal: nutrition.carbsG * 4, color: '#2468D8' },
      ]
    : [];

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
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.firstName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{profile.firstName}</Text>
          <Body muted style={styles.small}>
            {GOAL_LABELS[profile.goal]}
            {measurements.length > 0 ? ` · ${measurements.join(' · ')}` : ''}
          </Body>
        </View>
        <Badge tone="accent" icon="trending-up" label={LEVEL_LABELS[profile.level]} />
      </View>

      <Card>
        <Heading>Mon programme</Heading>
        <InfoRow icon="calendar-outline" label="Jours" value={days || 'à choisir'} />
        <InfoRow icon="time-outline" label="Durée" value={`${profile.minutesPerSession} min`} />
        <InfoRow
          icon="shield-checkmark-outline"
          label="À ménager"
          value={profile.painZones.length ? profile.painZones.map((z) => ZONE_LABELS[z]).join(', ') : 'Aucune zone'}
        />
        <InfoRow
          icon="notifications-outline"
          label="Rappels"
          value={profile.reminderEnabled ? `${profile.reminderHour} h` : 'Désactivés'}
        />
        <Button
          label="Modifier mon profil"
          icon="create-outline"
          variant="secondary"
          onPress={() => router.push('/edit-profile')}
        />
      </Card>

      <Card>
        <Heading>Mes besoins caloriques</Heading>
        {nutrition ? (
          <>
            <View style={styles.kcalRow}>
              <Text style={styles.kcal}>{nutrition.target.toLocaleString('fr-FR')}</Text>
              <Text style={styles.kcalUnit}>kcal par jour</Text>
            </View>
            <View style={styles.macroBar}>
              {macros.map((macro) => (
                <View key={macro.label} style={{ flex: macro.kcal, backgroundColor: macro.color }} />
              ))}
            </View>
            <View style={styles.macros}>
              {macros.map((macro) => (
                <View key={macro.label} style={styles.macro}>
                  <View style={[styles.macroDot, { backgroundColor: macro.color }]} />
                  <Text style={styles.macroValue}>{macro.grams} g</Text>
                  <Text style={styles.macroLabel}>{macro.label}</Text>
                </View>
              ))}
            </View>
            <Body muted style={styles.small}>
              Maintien de ton poids : {nutrition.maintenance} kcal. Estimation à partir de ton âge, ta
              taille, ton poids et ton activité ; ce n&apos;est pas un avis médical.
            </Body>
          </>
        ) : (
          <>
            <Body muted>
              Renseigne ton âge, ton sexe, ta taille et ton poids pour obtenir une estimation. Ces
              infos sont facultatives et restent sur ton téléphone.
            </Body>
            <Button
              label="Compléter"
              icon="add"
              variant="secondary"
              onPress={() => router.push('/edit-profile')}
            />
          </>
        )}
      </Card>

      <Card>
        <Heading>Séance guidée</Heading>
        <Body muted style={styles.small}>
          Le coach annonce les exercices et le décompte à voix haute.
        </Body>
        <Row>
          <Chip
            label="Voix activée"
            icon="volume-high"
            selected={voiceEnabled}
            onPress={() => setVoiceEnabled(true)}
          />
          <Chip
            label="Sans voix"
            icon="volume-mute"
            selected={!voiceEnabled}
            onPress={() => setVoiceEnabled(false)}
          />
        </Row>
      </Card>

      <Card>
        <Heading>Mes données</Heading>
        <Body muted style={styles.small}>
          Tu utilises Aria sans compte : tout est gardé sur ce téléphone. Les comptes arriveront
          pour sauvegarder ta progression et débloquer les succès.
        </Body>
        {testMode && <Badge icon="flask" label="Mode test : tout est débloqué" />}
        <Text style={styles.subLabel}>Statistiques d&apos;usage anonymes</Text>
        <Row>
          <Chip label="J'accepte" selected={consent.analytics} onPress={() => setConsent({ analytics: true })} />
          <Chip label="Non merci" selected={!consent.analytics} onPress={() => setConsent({ analytics: false })} />
        </Row>
        <View style={styles.links}>
          <LinkRow href="/privacy" icon="document-text-outline" label="Politique de confidentialité" />
          <LinkRow href="/feedback" icon="chatbox-ellipses-outline" label="Donner mon avis" />
        </View>
      </Card>

      <Button
        label="Refaire l'onboarding"
        icon="refresh"
        variant="secondary"
        onPress={() => router.push('/onboarding')}
      />
      <Button label="Tout effacer" icon="trash-outline" variant="ghost" onPress={confirmReset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  small: { fontSize: 14, lineHeight: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontFamily: Fonts.extrabold, color: Colors.accent },
  name: { fontSize: 26, lineHeight: 32, fontFamily: Fonts.extrabold, color: Colors.text, letterSpacing: -0.6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 2 },
  infoLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: Colors.text },
  infoValue: { flex: 1, textAlign: 'right', fontSize: 15, fontFamily: Fonts.regular, color: Colors.textSecondary },
  kcalRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  kcal: { fontSize: 38, lineHeight: 44, fontFamily: Fonts.extrabold, color: Colors.text, letterSpacing: -1 },
  kcalUnit: { fontSize: 15, fontFamily: Fonts.medium, color: Colors.textSecondary },
  macroBar: { flexDirection: 'row', height: 10, borderRadius: Radius.pill, overflow: 'hidden', gap: 3 },
  macros: { flexDirection: 'row', justifyContent: 'space-between' },
  macro: { gap: 2 },
  macroDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  macroValue: { fontSize: 17, fontFamily: Fonts.bold, color: Colors.text },
  macroLabel: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textSecondary },
  subLabel: { fontSize: 14, fontFamily: Fonts.semibold, color: Colors.text },
  links: { gap: Spacing.sm, marginTop: Spacing.xs },
});
