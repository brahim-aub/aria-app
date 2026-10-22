import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, Switch, Text, View } from 'react-native';

import { Field } from '@/components/kit';
import { Button, Card, Chip, H2, Muted, Screen, Stepper } from '@/components/ui';
import { EQUIPMENT_LABEL } from '@/data/exercises';
import { DAY_SHORT, defaultDays, GOAL_LABEL, LEVEL_LABEL } from '@/data/generator';
import { generateJSON, SEARCH_PRICE } from '@/lib/gemini';
import { requestReminderPermission } from '@/lib/notifications';
import { JOB_LABEL } from '@/lib/nutrition';
import { confirmAction, notify } from '@/lib/confirm';
import { authErrorMessage } from '@/lib/supabase';
import { useApp } from '@/store/AppStore';
import { useAuth } from '@/store/AuthStore';
import type { Equipment, Goal, JobActivity, Level, Place, Profile, Reminders } from '@/store/types';
import { colors, font, radius, spacing, type } from '@/theme';

const PLACES: Record<Place, string> = { maison: 'Maison', salle: 'Salle', exterieur: 'Dehors' };
const DURATIONS = [10, 15, 20, 30, 45, 60, 75, 90];
const PLAN_FIELDS: (keyof Profile)[] = ['goal', 'level', 'place', 'equipment', 'sessionsPerWeek', 'sessionMinutes', 'trainingDays'];

const pad = (n: number) => String(n).padStart(2, '0');

export default function Reglages() {
  const { data, ai, setAiTier, setHealthConsent, updateProfile, setReminders: saveRemindersState, setApiKey, resetAll } = useApp();
  const [p, setP] = useState<Profile>(data.profile);
  const [weightText, setWeightText] = useState(String(data.profile.weightKg));
  const [reminders, setReminders] = useState<Reminders>(data.reminders);
  const [saving, setSaving] = useState(false);
  const [keyText, setKeyText] = useState(data.apiKey);
  const [testing, setTesting] = useState(false);
  const auth = useAuth();

  const set = (patch: Partial<Profile>) => setP((cur) => ({ ...cur, ...patch }));
  const profileDirty = JSON.stringify(p) !== JSON.stringify(data.profile) || String(data.profile.weightKg) !== weightText;
  const planChanged = PLAN_FIELDS.some((f) => JSON.stringify(p[f]) !== JSON.stringify(data.profile[f]));
  const daysOk = p.trainingDays.length === p.sessionsPerWeek;
  const remindersDirty = JSON.stringify(reminders) !== JSON.stringify(data.reminders);

  const saveProfile = () => {
    const kg = parseFloat(weightText.replace(',', '.'));
    const next = { ...p, weightKg: Number.isFinite(kg) && kg > 25 && kg < 350 ? Math.round(kg * 10) / 10 : data.profile.weightKg };
    updateProfile(next, planChanged);
    notify('Enregistré', planChanged ? 'Ton programme a été reconstruit avec ces réglages.' : 'Profil mis à jour.');
  };

  const saveReminders = async () => {
    setSaving(true);
    try {
      // Les rappels eux-mêmes sont programmés par useReminderSync, selon le planning.
      const ok = !reminders.enabled || (await requestReminderPermission());
      if (!ok) {
        notify('Notifications refusées', 'Autorise les notifications pour Aria Sport dans les paramètres Android pour recevoir les rappels.');
        return;
      }
      saveRemindersState(reminders);
      notify('Rappels enregistrés', reminders.enabled ? `Rappel à ${pad(reminders.hour)}h${pad(reminders.minute)} les jours où une séance est prévue.` : 'Rappels désactivés.');
    } catch (e) {
      notify('Erreur', String(e));
    } finally {
      setSaving(false);
    }
  };

  const testKey = async () => {
    const typed = keyText.trim();
    setTesting(true);
    try {
      // Clé tapée : test direct de cette clé. Sinon : test du chemin actuel (relais du compte ou clé intégrée).
      await generateJSON<{ ok: boolean }>({
        ...(typed ? { apiKey: typed, personalKey: true, tier: ai.tier } : ai),
        kind: 'test',
        system: 'Réponds {"ok": true}.',
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        timeoutMs: 30000,
      });
      setApiKey(typed);
      notify('Le coach est connecté ✅', typed ? 'La clé fonctionne.' : 'Le coach répond.');
    } catch (e) {
      notify('Échec', (e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  /** Portabilité (RGPD) : toutes les données en JSON, via le menu de partage. La clé personnelle est retirée. */
  const exportData = async () => {
    const { apiKey: _secret, ...rest } = data;
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'Aria Sport', data: rest }, null, 2);
    try {
      await Share.share({ title: 'Mes données Aria Sport', message: json });
    } catch (e) {
      notify('Export impossible', (e as Error).message);
    }
  };

  const toggleEquip = (e: Equipment) => set({ equipment: p.equipment.includes(e) ? p.equipment.filter((x) => x !== e) : [...p.equipment, e] });
  const toggleDay = (d: number) => set({ trainingDays: p.trainingDays.includes(d) ? p.trainingDays.filter((x) => x !== d) : [...p.trainingDays, d].sort() });

  return (
    <Screen top={false}>
      <AccountCard />

      <Card>
        <H2>Toi</H2>
        <Field label="Prénom" value={p.name} onChangeText={(name) => set({ name })} placeholder="Ton prénom" />
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>Âge</Text>
          <Stepper label="Âge" value={p.age} onChange={(age) => set({ age })} min={12} max={100} format={(v) => `${v} ans`} />
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.rowLabel}>Taille</Text>
          <Stepper label="Taille" value={p.heightCm} onChange={(heightCm) => set({ heightCm })} min={120} max={230} format={(v) => `${v} cm`} />
        </View>
        <Field label="Poids (kg)" value={weightText} onChangeText={setWeightText} keyboardType="decimal-pad" />
        <View style={styles.chips}>
          {(['homme', 'femme', 'autre'] as const).map((s) => (
            <Chip key={s} label={s === 'homme' ? 'Homme' : s === 'femme' ? 'Femme' : 'Autre'} active={p.sex === s} onPress={() => set({ sex: s })} />
          ))}
        </View>
        <Text style={styles.label}>Quotidien</Text>
        <View style={styles.chips}>
          {(Object.keys(JOB_LABEL) as JobActivity[]).map((j) => (
            <Chip key={j} label={JOB_LABEL[j]} active={p.job === j} onPress={() => set({ job: j })} />
          ))}
        </View>
      </Card>

      <Card>
        <H2>Programme</H2>
        <Text style={styles.label}>Objectif</Text>
        <View style={styles.chips}>
          {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => (
            <Chip key={g} label={GOAL_LABEL[g]} active={p.goal === g} onPress={() => set({ goal: g })} />
          ))}
        </View>
        <Text style={styles.label}>Niveau</Text>
        <View style={styles.chips}>
          {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
            <Chip key={l} label={LEVEL_LABEL[l]} active={p.level === l} onPress={() => set({ level: l })} />
          ))}
        </View>
        <Text style={styles.label}>Lieu</Text>
        <View style={styles.chips}>
          {(Object.keys(PLACES) as Place[]).map((pl) => (
            <Chip key={pl} label={PLACES[pl]} active={p.place === pl} onPress={() => set({ place: pl })} />
          ))}
        </View>
        <Text style={styles.label}>Matériel</Text>
        <View style={styles.chips}>
          {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => (
            <Chip key={e} label={EQUIPMENT_LABEL[e]} active={p.equipment.includes(e)} onPress={() => toggleEquip(e)} />
          ))}
        </View>
        <Text style={styles.label}>Séances par semaine</Text>
        <View style={styles.chips}>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <Chip key={n} label={`${n}`} active={p.sessionsPerWeek === n} onPress={() => set({ sessionsPerWeek: n, trainingDays: defaultDays(n) })} />
          ))}
        </View>
        <Text style={styles.label}>Durée</Text>
        <View style={styles.chips}>
          {DURATIONS.map((m) => (
            <Chip key={m} label={`${m} min`} active={p.sessionMinutes === m} onPress={() => set({ sessionMinutes: m })} />
          ))}
        </View>
        <Text style={styles.label}>Jours</Text>
        <View style={styles.chips}>
          {DAY_SHORT.map((d, i) => (
            <Chip key={d} label={d} active={p.trainingDays.includes(i)} onPress={() => toggleDay(i)} />
          ))}
        </View>
        {!daysOk && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            Choisis {p.sessionsPerWeek} jour{p.sessionsPerWeek > 1 ? 's' : ''} ({p.trainingDays.length} sélectionné{p.trainingDays.length > 1 ? 's' : ''}).
          </Text>
        )}
      </Card>

      {profileDirty && (
        <Button title={planChanged ? 'Enregistrer et reconstruire le programme' : 'Enregistrer'} icon="checkmark" big onPress={saveProfile} disabled={!daysOk} />
      )}

      <Card>
        <H2>Coach IA</H2>
        <Muted>Modèle utilisé par le coach et pour les menus. La recherche de prix utilise toujours le modèle le plus précis.</Muted>
        <View style={styles.chips}>
          <Chip label="Économique" icon="leaf-outline" active={ai.tier === 'eco'} onPress={() => setAiTier('eco')} />
          <Chip label="Qualité" icon="diamond-outline" active={ai.tier === 'quality'} onPress={() => setAiTier('quality')} />
        </View>
        <Muted style={{ fontSize: 12 }}>
          {ai.tier === 'eco' ? 'Gemini Flash-Lite, environ 5 fois moins cher. Bascule sur Flash si besoin.' : 'Gemini Flash : réponses plus fines, coût plus élevé.'}
        </Muted>
        <AiUsageSummary />
        <Text style={styles.label}>Clé personnelle (facultatif)</Text>
        <Muted style={{ fontSize: 12 }}>
          {data.apiKey
            ? 'Ta clé est utilisée à la place de celle du serveur.'
            : auth.session
              ? 'Le coach passe par ton compte : aucune clé n’est nécessaire.'
              : 'Sans compte, colle ici ta clé Google AI Studio (aistudio.google.com).'}
        </Muted>
        <Field value={keyText} onChangeText={setKeyText} placeholder="AIza…" autoCapitalize="none" autoCorrect={false} secureTextEntry accessibilityLabel="Clé Gemini personnelle" />
        <Button title={testing ? 'Test en cours…' : keyText.trim() ? 'Tester et enregistrer la clé' : 'Tester le coach'} icon="flash" variant="secondary" onPress={testKey} loading={testing} />
        {data.apiKey ? <Button title="Retirer ma clé personnelle" variant="ghost" onPress={() => { setKeyText(''); setApiKey(''); }} /> : null}
      </Card>

      <Card>
        <View style={styles.rowBetween}>
          <H2>Rappels</H2>
          <Switch
            accessibilityLabel="Activer les rappels"
            value={reminders.enabled}
            onValueChange={(enabled) => setReminders((r) => ({ ...r, enabled }))}
            trackColor={{ true: colors.accent, false: colors.borderStrong }}
            thumbColor={reminders.enabled ? colors.dark : colors.card}
          />
        </View>
        {reminders.enabled && (
          <>
            <Muted>Un rappel les jours où une séance est prévue. Si une séance est décalée ou annulée, le rappel suit.</Muted>
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>Heure</Text>
              <Stepper label="Heure du rappel" value={reminders.hour} onChange={(hour) => setReminders((r) => ({ ...r, hour }))} min={5} max={23} format={(v) => `${pad(v)}h`} />
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.rowLabel}>Minutes</Text>
              <Stepper label="Minutes du rappel" value={reminders.minute} onChange={(minute) => setReminders((r) => ({ ...r, minute }))} step={15} min={0} max={45} format={pad} />
            </View>
          </>
        )}
        <Button
          title={saving ? 'Enregistrement…' : 'Enregistrer les rappels'}
          onPress={saveReminders}
          disabled={saving || !remindersDirty}
          variant={remindersDirty ? 'primary' : 'secondary'}
        />
      </Card>

      <Card>
        <H2>Confidentialité</H2>
        <Muted>
          {auth.enabled
            ? 'Tes données sont sur ce téléphone et sur ton compte. Tes messages au coach (et le contexte de ton programme) sont envoyés à Gemini.'
            : 'Tout est stocké uniquement sur ce téléphone. Seuls tes messages au coach (et le contexte de ton programme) sont envoyés à Gemini.'}
        </Muted>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: spacing.sm }}>
            <Text style={styles.label}>Accord pour le coach IA</Text>
            <Muted style={{ fontSize: 12 }}>
              {data.healthConsentAt
                ? `Donné le ${new Date(data.healthConsentAt).toLocaleDateString('fr-FR')}. Sans accord, le coach, les menus et la recherche de prix sont désactivés.`
                : 'Pas d’accord : rien n’est envoyé à Google Gemini.'}
            </Muted>
          </View>
          <Switch
            accessibilityLabel="Accord pour le coach IA"
            value={!!data.healthConsentAt}
            onValueChange={setHealthConsent}
            trackColor={{ true: colors.accent, false: colors.borderStrong }}
            thumbColor={data.healthConsentAt ? colors.dark : colors.card}
          />
        </View>
        <Button title="Politique de confidentialité" variant="secondary" icon="shield-checkmark-outline" onPress={() => router.push('/confidentialite')} />
        <Button title="Exporter mes données" variant="secondary" icon="download-outline" onPress={exportData} />
      </Card>

      <Card style={styles.danger}>
        <H2>Repartir de zéro</H2>
        <Muted>Ces actions modifient ton programme ou effacent tes données.</Muted>
        <Button
          title="Refaire le questionnaire"
          variant="secondary"
          icon="refresh"
          onPress={() =>
            void confirmAction('Refaire le questionnaire ?', 'Ton programme sera recréé. Ton historique et tes succès sont conservés.', 'Continuer').then((ok) => {
              if (ok) updateProfile({ onboarded: false });
            })
          }
        />
        <Button
          title="Effacer toutes les données"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            void confirmAction('Tout effacer ?', auth.enabled ? 'Séances, pesées, conversation, succès et réglages seront supprimés définitivement, aussi sur ton compte.' : 'Séances, pesées, conversation, succès et réglages seront supprimés définitivement.', 'Tout effacer', true).then((ok) => {
              if (ok) resetAll();
            })
          }
        />
      </Card>
      <Text style={styles.version}>Aria Sport, version 2.0</Text>
    </Screen>
  );
}

const KIND_LABEL = { chat: 'Coach', meal: 'Menus', prices: 'Prix', test: 'Tests' } as const;
const fmtTokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));

function AiUsageSummary() {
  const { data } = useApp();
  const month = new Date().toISOString().slice(0, 7);
  const u = data.aiUsage?.month === month ? data.aiUsage : undefined;
  const rows = u ? (Object.entries(u.kinds) as [keyof typeof KIND_LABEL, NonNullable<(typeof u.kinds)['chat']>][]) : [];
  if (!rows.length) return <Muted style={{ fontSize: 12 }}>Aucune utilisation de l’IA ce mois-ci sur ce téléphone.</Muted>;
  const total = rows.reduce((s, [, k]) => s + k.costUsd, 0);
  const searches = rows.reduce((s, [, k]) => s + k.searches, 0);
  return (
    <View style={styles.usage}>
      <Text style={styles.label}>Consommation de ce mois</Text>
      {rows.map(([kind, k]) => (
        <View key={kind} style={styles.rowBetween}>
          <Muted>{KIND_LABEL[kind]} · {k.calls} appel{k.calls > 1 ? 's' : ''}</Muted>
          <Muted>
            {fmtTokens(k.tokensIn)} entrée{k.tokensCached ? ` (dont ${fmtTokens(k.tokensCached)} en cache)` : ''} · {fmtTokens(k.tokensOut)} sortie
          </Muted>
        </View>
      ))}
      <Muted style={{ fontSize: 12 }}>
        Coût estimé des tokens : {total.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} $
        {searches ? ` · ${searches} recherche${searches > 1 ? 's' : ''} Google (gratuites jusqu’à 5 000/mois, puis ${SEARCH_PRICE} $ chacune)` : ''}. Tarif de référence relevé pour l’étude, hors cache.
      </Muted>
    </View>
  );
}

const SYNC_LABEL = { off: 'Synchronisation arrêtée', pulling: 'Récupération de tes données…', choice: 'En attente de ton choix', saving: 'Enregistrement…', synced: 'Synchronisé', error: 'Échec de la synchronisation' } as const;

function AccountCard() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  if (!auth.enabled || !auth.session) return null;
  const { status, at, error } = auth.sync;
  const time = at ? new Date(at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const color = status === 'error' ? colors.danger : status === 'synced' ? colors.accentInk : colors.muted;

  const confirmDelete = async () => {
    const ok = await confirmAction('Supprimer ton compte ?', 'Ton compte et toutes les données enregistrées dessus seront supprimés définitivement. Cette action est irréversible.', 'Supprimer', true);
    if (!ok) return;
    setBusy(true);
    try {
      await auth.deleteAccount();
    } catch (e) {
      notify('Suppression impossible', authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOut = async () => {
    const ok = await confirmAction('Se déconnecter ?', 'Tes données restent sur ton compte. Elles seront retirées de ce téléphone.', 'Se déconnecter');
    if (ok) auth.signOut().catch((e) => notify('Erreur', authErrorMessage(e)));
  };

  return (
    <Card>
      <H2>Mon compte</H2>
      <Text style={styles.label}>{auth.email}</Text>
      <View style={styles.syncRow}>
        {status === 'saving' || status === 'pulling' ? <ActivityIndicator size="small" color={colors.muted} /> : <View style={[styles.syncDot, { backgroundColor: color }]} />}
        <Text style={[styles.syncText, { color }]}>
          {SYNC_LABEL[status]}
          {status === 'synced' && time ? ` · ${time}` : ''}
        </Text>
      </View>
      {status === 'error' && error ? <Muted style={{ fontSize: 12 }}>{error}</Muted> : null}
      <Button
        title="Se déconnecter"
        variant="secondary"
        icon="log-out-outline"
        disabled={busy}
        onPress={confirmSignOut}
      />
      <Button title="Supprimer mon compte" variant="ghost" icon="person-remove-outline" disabled={busy} onPress={confirmDelete} />
    </Card>
  );
}

const styles = StyleSheet.create({
  usage: { gap: 4, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.ms },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  syncDot: { width: 8, height: 8, borderRadius: 4 },
  syncText: { fontFamily: font.bold, fontSize: 13 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  label: { color: colors.text, fontFamily: font.black, fontSize: 15, marginTop: spacing.sm },
  rowLabel: { color: colors.text, fontFamily: font.bold, fontSize: 14 },
  error: { color: colors.danger, ...type.small, fontFamily: font.bold },
  danger: { borderColor: colors.pinkDim },
  version: { color: colors.muted, ...type.small, textAlign: 'center' },
});
