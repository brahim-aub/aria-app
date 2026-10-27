import Ionicons from '@expo/vector-icons/Ionicons';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';

import { EXERCISE_HD } from '@/data/exerciseHd';
import { EXERCISE_MEDIA_CREDIT, exerciseGifUrl } from '@/data/exerciseMedia';
import { useReducedMotion } from '@/lib/motion';
import { colors, font, radius, spacing } from '@/theme';
import { Button, IconButton } from './ui';

type Props = { exerciseId: string; active?: boolean; compact?: boolean };

/** Vidéo 3D locale prioritaire. Le GIF historique reste un choix explicite sur les mouvements non couverts. */
export function ExerciseDemo({ exerciseId, active = true, compact = false }: Props) {
  const media = EXERCISE_HD[exerciseId];
  return media ? <HdDemo key={exerciseId} media={media} active={active} compact={compact} /> : <ClassicDemo key={exerciseId} exerciseId={exerciseId} active={active} />;
}

function HdDemo({ media, active, compact }: { media: (typeof EXERCISE_HD)[string]; active: boolean; compact: boolean }) {
  const reduced = useReducedMotion();
  const [requestedPlay, setRequestedPlay] = useState<boolean | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [speed, setSpeed] = useState<1 | 0.5>(1);
  const [retry, setRetry] = useState(0);
  const player = useVideoPlayer(media.source, (p) => { p.loop = true; p.muted = true; });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const playing = active && foreground && (requestedPlay ?? !reduced);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => { if (playing) player.play(); else player.pause(); }, [player, playing]);
  useEffect(() => {
    // Expo Video expose la vitesse par un setter impératif sur son objet natif stable.
    // eslint-disable-next-line react-hooks/immutability
    player.playbackRate = speed;
  }, [player, speed]);
  return <View style={s.box}>
    <View style={s.heading}><Text style={s.label}>LE MOUVEMENT</Text><Text style={s.badge}>3D HD</Text></View>
    {status === 'loading' && <ActivityIndicator accessibilityLabel="Chargement de la démonstration" color={colors.accent} />}
    <VideoView key={retry} player={player} style={[s.video, compact && { height: 170 }]} contentFit="contain" nativeControls={false} accessibilityLabel="Démonstration 3D du mouvement" fullscreenOptions={{ enable: false }} />
    {status === 'error' && <View style={s.message}><Text style={s.hint}>La démonstration n’a pas pu se charger. Les consignes restent disponibles.</Text><Button title="Réessayer la démonstration" variant="secondary" onPress={() => { void player.replaceAsync(media.source).then(() => { setRetry((r) => r + 1); if (playing) player.play(); }).catch(() => {}); }} /></View>}
    <View style={s.controls}>
      <IconButton icon={isPlaying ? 'pause' : 'play'} label={isPlaying ? 'Mettre la démonstration en pause' : 'Lire la démonstration'} onPress={() => setRequestedPlay(!isPlaying)} />
      <Button title={speed === 1 ? 'Ralentir ×0,5' : 'Vitesse ×1'} variant="ghost" onPress={() => setSpeed(speed === 1 ? 0.5 : 1)} />
      <Text style={s.credit}>{media.provider}</Text>
    </View>
  </View>;
}

function ClassicDemo({ exerciseId, active }: { exerciseId: string; active: boolean }) {
  const uri = exerciseGifUrl(exerciseId);
  const reduced = useReducedMotion();
  const [opened, setOpened] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!uri) return null;
  return <View style={s.classic}>
    <Button title={opened ? 'Masquer l’animation' : 'Voir l’animation du mouvement'} icon="play-circle-outline" variant="secondary" onPress={() => setOpened(!opened)} />
    {opened && !failed && <View style={s.gifBox}><Image source={{ uri }} style={{ width: '100%', height: 210 }} contentFit="contain" cachePolicy="memory" autoplay={active && !reduced} accessibilityLabel="Animation classique du mouvement" onError={() => setFailed(true)} /><Text style={[s.credit, { color: '#526052' }]}>{EXERCISE_MEDIA_CREDIT}</Text></View>}
    {opened && failed && <Text style={s.hint}>Animation indisponible. Suis les repères du mouvement ci-dessous.</Text>}
    {!opened && <View style={s.guide}><Ionicons name="body-outline" size={18} color={colors.muted} /><Text style={s.hint}>Les repères du mouvement sont juste en dessous.</Text></View>}
  </View>;
}
const s = StyleSheet.create({
  box: { backgroundColor: '#101410', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.ms },
  label: { color: colors.muted, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2 },
  badge: { color: colors.accent, fontFamily: font.bold, fontSize: 11 },
  video: { width: '100%', height: 240, backgroundColor: '#FFFFFF' },
  controls: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, gap: 4, flexWrap: 'wrap' },
  credit: { color: colors.muted, fontFamily: font.regular, fontSize: 10, flexShrink: 1 },
  classic: { gap: spacing.sm },
  guide: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hint: { color: colors.muted, fontFamily: font.regular, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  gifBox: { backgroundColor: '#fff', borderRadius: radius.md, padding: 8, alignItems: 'center' },
  message: { padding: spacing.md, gap: spacing.sm },
});
