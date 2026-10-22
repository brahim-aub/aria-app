import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Field } from '@/components/kit';
import { Button, Card, Chip, H2, Muted, RatingPicker, Screen, Stepper } from '@/components/ui';
import { useApp } from '@/store/AppStore';
import { spacing } from '@/theme';

const ACTIVITIES = ['Marche', 'Renfo maison', 'Vélo', 'Course', 'Étirements / yoga', 'Natation', 'Autre'];

export default function AddFreeSession() {
  const { addLog } = useApp();
  const [activity, setActivity] = useState('Marche');
  const [custom, setCustom] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [difficulty, setDifficulty] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [note, setNote] = useState('');

  const title = activity === 'Autre' ? custom.trim() || 'Activité libre' : activity;

  const save = () => {
    addLog({ kind: 'free', title, durationMin: minutes, difficulty, energy, note: note.trim() || undefined });
    router.back();
  };

  return (
    <Screen top={false}>
      <Muted>Ajoute une activité faite en dehors du programme. Elle compte dans ton objectif de la semaine.</Muted>
      <Card>
        <H2>Activité</H2>
        <View style={styles.chips}>
          {ACTIVITIES.map((a) => (
            <Chip key={a} label={a} active={activity === a} onPress={() => setActivity(a)} />
          ))}
        </View>
        {activity === 'Autre' && (
          <Field value={custom} onChangeText={setCustom} placeholder="Nom de l’activité" accessibilityLabel="Nom de l’activité" />
        )}
      </Card>
      <Card>
        <H2>Durée</H2>
        <View style={{ alignItems: 'center' }}>
          <Stepper label="Durée" value={minutes} onChange={setMinutes} step={5} min={5} max={300} format={(v) => `${v} min`} />
        </View>
      </Card>
      <Card>
        <H2>Difficulté</H2>
        <RatingPicker kind="difficulty" value={difficulty} onChange={setDifficulty} />
      </Card>
      <Card>
        <H2>Énergie après</H2>
        <RatingPicker kind="energy" value={energy} onChange={setEnergy} />
      </Card>
      <Card>
        <H2>Note</H2>
        <Field value={note} onChangeText={setNote} placeholder="Facultatif" accessibilityLabel="Note" multiline />
      </Card>
      <Button title="Enregistrer l’activité" icon="checkmark" big onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
