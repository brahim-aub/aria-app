import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Body, Button, Card, Chip, Row, Screen } from '@/components/ui';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { LEVEL_LABELS, ZONE_LABELS } from '@/data/exercises';
import { EQUIPMENT_LABELS, GOAL_LABELS, MINUTE_OPTIONS } from '@/lib/labels';
import { remindersSupported, syncReminders } from '@/lib/reminders';
import type { Equipment, Goal, Level, Profile, Sex, Zone } from '@/lib/types';
import { DAY_SHORT, WEEK_ORDER } from '@/lib/week';
import { useAppStore } from '@/store/app-store';

const GOALS = Object.keys(GOAL_LABELS) as Goal[];
const ZONES = Object.keys(ZONE_LABELS) as Zone[];
const EQUIPMENT = Object.keys(EQUIPMENT_LABELS) as Equipment[];
const LEVELS: Level[] = [1, 2, 3];
const REMINDER_HOURS = [7, 12, 18, 20];

type NumberField = { key: 'age' | 'heightCm' | 'weightKg'; label: string; unit: string; min: number; max: number };

const NUMBER_FIELDS: NumberField[] = [
  { key: 'age', label: 'Âge', unit: 'ans', min: 16, max: 99 },
  { key: 'heightCm', label: 'Taille', unit: 'cm', min: 120, max: 230 },
  { key: 'weightKg', label: 'Poids', unit: 'kg', min: 30, max: 250 },
];

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function parseNumber(text: string) {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' ? null : Number.isFinite(value) ? Math.round(value) : NaN;
}

export default function EditProfile() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const updateProfile = useAppStore((state) => state.updateProfile);

  const [draft, setDraft] = useState<Profile | null>(profile);
  const [numbers, setNumbers] = useState<Record<NumberField['key'], string>>({
    age: profile?.age?.toString() ?? '',
    heightCm: profile?.heightCm?.toString() ?? '',
    weightKg: profile?.weightKg?.toString() ?? '',
  });
  const [notice, setNotice] = useState<string | null>(null);

  if (!profile || !draft) return null;

  const set = (patch: Partial<Profile>) => setDraft({ ...draft, ...patch });

  const invalidFields = NUMBER_FIELDS.filter((field) => {
    const value = parseNumber(numbers[field.key]);
    return value !== null && (Number.isNaN(value) || value < field.min || value > field.max);
  });
  const canSave =
    draft.firstName.trim() !== '' && draft.trainingDays.length > 0 && invalidFields.length === 0;

  const save = async () => {
    const next: Profile = {
      ...draft,
      firstName: draft.firstName.trim(),
      age: parseNumber(numbers.age),
      heightCm: parseNumber(numbers.heightCm),
      weightKg: parseNumber(numbers.weightKg),
    };
    const allowed = await syncReminders(next);
    if (!allowed) {
      updateProfile({ ...next, reminderEnabled: false });
      setDraft({ ...next, reminderEnabled: false });
      setNotice(
        'Profil enregistré, mais les notifications sont refusées : autorise-les dans les réglages du téléphone pour recevoir les rappels.',
      );
      return;
    }
    updateProfile(next);
    router.back();
  };

  return (
    <Screen edges={['bottom']}>
      <Card>
        <Text style={styles.label}>Prénom</Text>
        <TextInput
          style={styles.input}
          value={draft.firstName}
          onChangeText={(firstName) => set({ firstName })}
          placeholder="Ton prénom"
        />
      </Card>

      <Card>
        <Text style={styles.label}>Objectif</Text>
        <Row>
          {GOALS.map((goal) => (
            <Chip key={goal} label={GOAL_LABELS[goal]} selected={draft.goal === goal} onPress={() => set({ goal })} />
          ))}
        </Row>
        <Text style={styles.label}>Niveau des exercices</Text>
        <Row>
          {LEVELS.map((level) => (
            <Chip
              key={level}
              label={LEVEL_LABELS[level]}
              selected={draft.level === level}
              onPress={() => set({ level })}
            />
          ))}
        </Row>
      </Card>

      <Card>
        <Text style={styles.label}>Jours d&apos;entraînement</Text>
        <Row>
          {WEEK_ORDER.map((day) => (
            <Chip
              key={day}
              label={DAY_SHORT[day]}
              selected={draft.trainingDays.includes(day)}
              onPress={() => set({ trainingDays: toggle(draft.trainingDays, day).sort() })}
            />
          ))}
        </Row>
        {draft.trainingDays.length === 0 && <Body muted>Choisis au moins un jour.</Body>}
        <Text style={styles.label}>Durée d&apos;une séance</Text>
        <Row>
          {MINUTE_OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes} min`}
              selected={draft.minutesPerSession === minutes}
              onPress={() => set({ minutesPerSession: minutes })}
            />
          ))}
        </Row>
      </Card>

      <Card>
        <Text style={styles.label}>Rappels</Text>
        {remindersSupported ? (
          <>
            <Row>
              <Chip label="Oui" selected={draft.reminderEnabled} onPress={() => set({ reminderEnabled: true })} />
              <Chip label="Non" selected={!draft.reminderEnabled} onPress={() => set({ reminderEnabled: false })} />
            </Row>
            {draft.reminderEnabled && (
              <Row>
                {REMINDER_HOURS.map((hour) => (
                  <Chip
                    key={hour}
                    label={`${hour} h`}
                    selected={draft.reminderHour === hour}
                    onPress={() => set({ reminderHour: hour })}
                  />
                ))}
              </Row>
            )}
          </>
        ) : (
          <Body muted>Les rappels fonctionnent uniquement dans l&apos;appli sur téléphone.</Body>
        )}
      </Card>

      <Card>
        <Text style={styles.label}>Matériel</Text>
        <Row>
          {EQUIPMENT.map((item) => (
            <Chip
              key={item}
              label={EQUIPMENT_LABELS[item]}
              selected={draft.equipment.includes(item)}
              onPress={() => set({ equipment: toggle(draft.equipment, item) })}
            />
          ))}
        </Row>
        <Text style={styles.label}>Zones à ménager</Text>
        <Row>
          {ZONES.map((zone) => (
            <Chip
              key={zone}
              label={ZONE_LABELS[zone]}
              selected={draft.painZones.includes(zone)}
              onPress={() => set({ painZones: toggle(draft.painZones, zone) })}
            />
          ))}
        </Row>
      </Card>

      <Card>
        <Text style={styles.label}>Pour le calcul des calories (facultatif)</Text>
        <Row>
          {(['homme', 'femme'] as Sex[]).map((sex) => (
            <Chip
              key={sex}
              label={sex === 'homme' ? 'Homme' : 'Femme'}
              selected={draft.sex === sex}
              onPress={() => set({ sex: draft.sex === sex ? null : sex })}
            />
          ))}
        </Row>
        {NUMBER_FIELDS.map((field) => (
          <View key={field.key} style={styles.numberRow}>
            <Text style={styles.numberLabel}>{field.label}</Text>
            <TextInput
              style={[styles.input, styles.numberInput]}
              value={numbers[field.key]}
              onChangeText={(text) => setNumbers({ ...numbers, [field.key]: text })}
              placeholder={field.unit}
              keyboardType="numeric"
            />
          </View>
        ))}
        {invalidFields.map((field) => (
          <Body key={field.key} muted>
            {field.label} : entre {field.min} et {field.max} {field.unit}.
          </Body>
        ))}
      </Card>

      {notice && <Body>{notice}</Body>}
      <Button label="Enregistrer" disabled={!canSave} onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.text },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: Fonts.medium,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
  },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  numberLabel: { width: 70, fontSize: 16, fontFamily: Fonts.regular, color: Colors.text },
  numberInput: { flex: 1 },
});
