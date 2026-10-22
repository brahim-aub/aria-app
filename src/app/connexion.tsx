import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, Notice, Segmented } from '@/components/kit';
import { Button } from '@/components/ui';
import { authErrorMessage } from '@/lib/supabase';
import { useAuth } from '@/store/AuthStore';
import { focusRing, PressState } from '@/lib/motion';
import { colors, font, radius, spacing, type } from '@/theme';

type Mode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

const TITLES: Record<Mode, string> = {
  signin: 'Connexion',
  signup: 'Créer mon compte',
  confirm: 'Confirme ton e-mail',
  forgot: 'Mot de passe oublié',
  reset: 'Nouveau mot de passe',
};

const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());

export default function Connexion() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const go = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setCode('');
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (mode !== 'confirm' && mode !== 'reset' && !isEmail(email)) return setError('Entre une adresse e-mail valide.');
    if (mode === 'signup' && !agree) return setError('Coche la case pour accepter l’enregistrement de tes données sur ton compte.');
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.');
    if (mode === 'reset' && code.trim().length < 6) return setError('Entre le code reçu par e-mail.');
    if (mode === 'signin') return run(() => auth.signIn(email, password));
    if (mode === 'signup')
      return run(async () => {
        const needsCode = await auth.signUp(email, password);
        if (needsCode) {
          go('confirm');
          setInfo(`Un e-mail de confirmation a été envoyé à ${email.trim()}. Ouvre le lien qu’il contient, puis reviens ici.`);
        }
      });
    // Le lien de l'e-mail active le compte côté Supabase ; il ne reste qu'à se connecter.
    if (mode === 'confirm') return run(() => auth.signIn(email, password));
    if (mode === 'forgot')
      return run(async () => {
        await auth.sendResetCode(email);
        go('reset');
        setInfo(`Si un compte existe pour ${email.trim()}, un code vient d’y être envoyé.`);
      });
    return run(() => auth.resetPassword(email, code, password));
  };

  const withPassword = mode === 'signin' || mode === 'signup' || mode === 'reset';
  const withCode = mode === 'reset';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Ionicons name="flash" size={22} color={colors.onAccent} />
            </View>
            <Text style={styles.heroTitle}>
              Où que tu sois,{'\n'}ta <Text style={styles.highlight}>santé</Text> d’abord
            </Text>
            <Text style={styles.heroText}>Un coach qui adapte ton programme à ta vie, chaque semaine.</Text>
          </View>

          <View style={styles.form}>
            {(mode === 'signin' || mode === 'signup') && (
              <Segmented
                label="Connexion ou inscription"
                value={mode}
                onChange={go}
                options={[
                  { value: 'signin', label: 'Connexion' },
                  { value: 'signup', label: 'Inscription' },
                ]}
              />
            )}
            {mode !== 'signin' && mode !== 'signup' && (
              <Text style={styles.title} role="heading" aria-level={1}>
                {TITLES[mode]}
              </Text>
            )}
            {info && (
              <Notice tone="success">
                <Text style={styles.noticeText}>{info}</Text>
              </Notice>
            )}

            {mode !== 'confirm' && mode !== 'reset' && (
              <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="toi@exemple.fr" />
            )}
            {withCode && (
              <Field label="Code reçu par e-mail" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={8} placeholder="123456" />
            )}
            {withPassword && (
              <View>
                <Field
                  label={mode === 'reset' ? 'Nouveau mot de passe' : 'Mot de passe'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  textContentType={mode === 'signin' ? 'password' : 'newPassword'}
                  placeholder={mode === 'signin' ? '••••••••' : '8 caractères minimum'}
                />
                <Pressable
                  onPress={() => setShowPw(!showPw)}
                  hitSlop={10}
                  accessibilityRole="button"
                  style={(s: PressState) => [styles.eye, focusRing(s, 8)]}
                  accessibilityLabel={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
                </Pressable>
              </View>
            )}

            {mode === 'signup' && (
              <Pressable onPress={() => setAgree(!agree)} style={(s: PressState) => [styles.agree, focusRing(s, 8)]} accessibilityRole="checkbox" accessibilityState={{ checked: agree }}>
                <View style={[styles.box, agree && styles.boxOn]}>{agree && <Ionicons name="checkmark" size={15} color={colors.onAccent} />}</View>
                <Text style={styles.agreeText}>
                  J’accepte que mes données, y compris de santé (douleurs, poids), soient enregistrées sur mon compte, hébergé dans l’Union européenne.{' '}
                  <Text style={styles.agreeLink} role="link" onPress={() => router.push('/confidentialite')}>
                    Politique de confidentialité
                  </Text>
                </Text>
              </Pressable>
            )}

            {error && (
              <Notice tone="danger">
                <Text style={styles.noticeText}>{error}</Text>
              </Notice>
            )}

            <Button
              big
              loading={busy}
              title={busy ? 'Un instant…' : mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : mode === 'forgot' ? 'Recevoir un code' : mode === 'confirm' ? 'J’ai confirmé, me connecter' : 'Valider'}
              onPress={submit}
              disabled={busy}
            />

            {mode === 'signin' && (
              <Pressable onPress={() => go('forgot')} accessibilityRole="link" style={(s: PressState) => [styles.link, focusRing(s, 8)]}>
                <Text style={styles.linkText}>Mot de passe oublié ?</Text>
              </Pressable>
            )}
            {mode === 'confirm' && (
              <Pressable onPress={() => run(async () => { await auth.resendConfirmation(email); setInfo('Nouvel e-mail envoyé.'); })} accessibilityRole="button" style={(s: PressState) => [styles.link, focusRing(s, 8)]}>
                <Text style={styles.linkText}>Renvoyer l’e-mail</Text>
              </Pressable>
            )}
            {mode !== 'signin' && mode !== 'signup' && (
              <Pressable onPress={() => go('signin')} accessibilityRole="link" style={(s: PressState) => [styles.link, focusRing(s, 8)]}>
                <Text style={[styles.linkText, { color: colors.muted }]}>Retour à la connexion</Text>
              </Pressable>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.md, flexGrow: 1, justifyContent: 'center', width: '100%', maxWidth: 480, alignSelf: 'center' },
  hero: { backgroundColor: colors.dark, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  logo: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  heroTitle: { color: colors.onDark, fontFamily: font.black, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  highlight: { color: colors.accent },
  heroText: { color: colors.onDarkMuted, fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  form: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontFamily: font.black, fontSize: 22 },
  noticeText: { color: colors.text, ...type.small, fontSize: 14, lineHeight: 20 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.dark },
  eye: { position: 'absolute', right: 14, bottom: 13 },
  link: { alignSelf: 'center', paddingHorizontal: 8, minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.accentInk, fontFamily: font.bold, fontSize: 15 },
  agree: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  agreeText: { flex: 1, color: colors.text, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  agreeLink: { color: colors.accentInk, fontFamily: font.bold, textDecorationLine: 'underline' },
});
