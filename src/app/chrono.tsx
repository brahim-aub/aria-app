import { useKeepAwake } from 'expo-keep-awake';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Segmented } from '@/components/kit';
import { Button, Card, Chip, Muted, Screen, Stepper } from '@/components/ui';
import { formatClock } from '@/lib/date';
import { endCue, useCountdownCues, useNow } from '@/lib/timer';
import { colors, spacing, font } from '@/theme';

type Mode = 'repos' | 'intervalles' | 'chrono';
type Segment = { label: string; sec: number; kind: 'work' | 'rest' };

const REST_PRESETS = [30, 45, 60, 90, 120];

const presetLabel = (s: number) => (s < 60 ? `${s} s` : s % 60 ? `${Math.floor(s / 60)} min ${s % 60}` : `${s / 60} min`);

export default function Chrono() {
  useKeepAwake();
  const [mode, setMode] = useState<Mode>('repos');

  return (
    <Screen top={false}>
      <Segmented
        label="Type de minuteur"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'repos', label: 'Repos' },
          { value: 'intervalles', label: 'Intervalles' },
          { value: 'chrono', label: 'Chronomètre' },
        ]}
      />
      {mode === 'repos' && <RestTimer />}
      {mode === 'intervalles' && <IntervalTimer />}
      {mode === 'chrono' && <Stopwatch />}
    </Screen>
  );
}

function useSegmentsRunner(segments: Segment[]) {
  const [running, setRunning] = useState(false);
  const [index, setIndex] = useState(0);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [pausedLeft, setPausedLeft] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const now = useNow(running && pausedLeft == null);

  const remainingMs = !running ? (segments[0]?.sec ?? 0) * 1000 : pausedLeft ?? (endAt ?? now) - now;
  useCountdownCues(running && pausedLeft == null ? remainingMs / 1000 : null);

  useEffect(() => {
    if (!running || pausedLeft != null || endAt == null) return;
    const t = setTimeout(() => {
      endCue();
      const next = index + 1;
      if (next >= segments.length) {
        setRunning(false);
        setFinished(true);
        setEndAt(null);
        return;
      }
      setIndex(next);
      setEndAt(Date.now() + segments[next].sec * 1000);
    }, Math.max(0, endAt - Date.now()));
    return () => clearTimeout(t);
  }, [running, pausedLeft, endAt, index, segments]);

  return {
    running,
    paused: pausedLeft != null,
    finished,
    index,
    segment: segments[running ? index : 0],
    remainingMs: Math.max(0, remainingMs),
    start() {
      setFinished(false);
      setIndex(0);
      setPausedLeft(null);
      setEndAt(Date.now() + (segments[0]?.sec ?? 0) * 1000);
      setRunning(true);
    },
    toggle() {
      if (pausedLeft != null) {
        setEndAt(Date.now() + pausedLeft);
        setPausedLeft(null);
      } else if (endAt != null) {
        setPausedLeft(Math.max(0, endAt - Date.now()));
      }
    },
    reset() {
      setRunning(false);
      setFinished(false);
      setIndex(0);
      setEndAt(null);
      setPausedLeft(null);
    },
  };
}

function BigClock({ ms, color, label }: { ms: number; color: string; label?: string }) {
  return (
    <View style={[styles.circle, { borderColor: color }]} accessible accessibilityRole="timer" accessibilityLabel={`${label ?? ''} ${formatClock(ms / 1000)}`}>
      {label && <Text style={[styles.circleLabel, { color }]}>{label}</Text>}
      <Text style={[styles.clock, { color }]}>{formatClock(ms / 1000)}</Text>
    </View>
  );
}

function Controls({ r }: { r: ReturnType<typeof useSegmentsRunner> }) {
  if (!r.running) return <Button title={r.finished ? 'Relancer' : 'Démarrer'} icon="play" big onPress={r.start} />;
  return (
    <View style={styles.row}>
      <Button title={r.paused ? 'Reprendre' : 'Pause'} icon={r.paused ? 'play' : 'pause'} onPress={r.toggle} style={{ flex: 1 }} />
      <Button title="Stop" icon="stop" variant="secondary" onPress={r.reset} style={{ flex: 1 }} />
    </View>
  );
}

function RestTimer() {
  const [sec, setSec] = useState(60);
  const segments = useMemo<Segment[]>(() => [{ label: 'Repos', sec, kind: 'rest' }], [sec]);
  const r = useSegmentsRunner(segments);
  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <BigClock ms={r.remainingMs} color={colors.rest} label={r.finished ? 'Terminé' : 'Repos'} />
        <View style={styles.presets}>
          {REST_PRESETS.map((p) => (
            <Chip key={p} label={presetLabel(p)} active={sec === p} onPress={() => { setSec(p); r.reset(); }} />
          ))}
        </View>
      </Card>
      <Controls r={r} />
    </>
  );
}

function IntervalTimer() {
  const [work, setWork] = useState(30);
  const [rest, setRest] = useState(30);
  const [rounds, setRounds] = useState(8);
  const segments = useMemo<Segment[]>(
    () =>
      Array.from({ length: rounds }, (_, i) => {
        const w: Segment = { label: `Effort ${i + 1}/${rounds}`, sec: work, kind: 'work' };
        const rs: Segment = { label: `Repos ${i + 1}/${rounds}`, sec: rest, kind: 'rest' };
        return i < rounds - 1 ? [w, rs] : [w];
      }).flat(),
    [work, rest, rounds],
  );
  const r = useSegmentsRunner(segments);
  const color = r.segment?.kind === 'rest' && r.running ? colors.rest : colors.accentInk;
  const totalSec = rounds * work + (rounds - 1) * rest;

  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <BigClock ms={r.running ? r.remainingMs : work * 1000} color={color} label={r.finished ? 'Terminé' : r.running ? r.segment?.label : 'Effort'} />
        <Muted>Durée totale : {formatClock(totalSec)}</Muted>
      </Card>
      {!r.running && (
        <Card>
          <SettingRow label="Effort">
            <Stepper label="Durée de l’effort" value={work} onChange={setWork} step={5} min={5} max={300} format={(v) => `${v}s`} />
          </SettingRow>
          <SettingRow label="Repos">
            <Stepper label="Durée du repos" value={rest} onChange={setRest} step={5} min={5} max={300} format={(v) => `${v}s`} />
          </SettingRow>
          <SettingRow label="Tours">
            <Stepper label="Nombre de tours" value={rounds} onChange={setRounds} min={1} max={30} />
          </SettingRow>
        </Card>
      )}
      <Controls r={r} />
    </>
  );
}

function Stopwatch() {
  const [startAt, setStartAt] = useState<number | null>(null);
  const [acc, setAcc] = useState(0);
  const running = startAt != null;
  const now = useNow(running, 100);
  const elapsed = acc + (running ? now - startAt : 0);
  return (
    <>
      <Card style={{ alignItems: 'center' }}>
        <BigClock ms={elapsed} color={colors.accentInk} label="Chrono" />
      </Card>
      <View style={styles.row}>
        <Button
          title={running ? 'Pause' : elapsed > 0 ? 'Reprendre' : 'Démarrer'}
          icon={running ? 'pause' : 'play'}
          onPress={() => {
            if (running) {
              setAcc(elapsed);
              setStartAt(null);
            } else setStartAt(Date.now());
          }}
          style={{ flex: 1 }}
        />
        <Button
          title="Remise à zéro"
          variant="secondary"
          disabled={elapsed === 0}
          onPress={() => {
            setStartAt(null);
            setAcc(0);
          }}
          style={{ flex: 1 }}
        />
      </View>
    </>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { width: 230, height: 230, borderRadius: 115, borderWidth: 8, alignItems: 'center', justifyContent: 'center', marginVertical: spacing.md },
  circleLabel: { fontSize: 15, fontFamily: font.black },
  clock: { fontSize: 60, fontFamily: font.black, fontVariant: ['tabular-nums'] },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLabel: { color: colors.text, fontSize: 16, fontFamily: font.bold },
});
