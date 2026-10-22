import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { EXERCISE_MEDIA_CREDIT, exerciseGifUrl } from '@/data/exerciseMedia';
import { colors, font, radius } from '@/theme';

/**
 * Animation de l'exercice, chargée en direct (pas de cache disque, voir exerciseMedia.ts).
 * Sans animation ou hors connexion, rien n'est affiché : les consignes écrites suffisent.
 */
export function ExerciseDemo({ exerciseId, size = 200 }: { exerciseId: string; size?: number }) {
  const uri = exerciseGifUrl(exerciseId);
  const [failed, setFailed] = useState<string | null>(null);
  if (!uri || failed === uri) return null;
  return (
    <View style={[styles.box, { width: size }]}>
      <Image
        source={{ uri }}
        style={{ width: size - 16, height: size - 16 }}
        contentFit="contain"
        cachePolicy="memory"
        transition={150}
        autoplay
        accessibilityLabel="Démonstration animée de l’exercice"
        onError={() => setFailed(uri)}
      />
      <View style={styles.credit}>
        <Ionicons name="play-circle" size={11} color={colors.muted} />
        <Text style={styles.creditText}>{EXERCISE_MEDIA_CREDIT}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Les GIF ont un fond blanc : la carte reste blanche pour qu'ils s'y fondent.
  box: { alignSelf: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingTop: 8, paddingBottom: 6, gap: 2 },
  credit: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  creditText: { fontFamily: font.regular, color: colors.muted, fontSize: 10 },
});
