import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { checkLogin, createAccount } from '@/lib/auth';
import { useAuth } from '@/lib/AuthContext';
import { authenticateBiometric, biometricInfo, getBiometricPref, setBiometricPref, type BiometricInfo } from '@/lib/biometric';
import { colors, fonts, radius, spacing } from '@/theme';

/** Tela de acesso: cria usuário e senha no primeiro uso; depois, pede o login. Fica por cima de todo o app. */
export function LoginScreen() {
  const { status, user: savedUser, unlock } = useAuth();
  const setup = status === 'setup';
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState(savedUser ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Face ID / digital: `bio` só existe quando o aparelho tem biometria cadastrada; `bioOn` = a pessoa escolheu usar
  const [bio, setBio] = useState<BiometricInfo | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const autoAsked = useRef(false);

  const tryBiometric = async (info: BiometricInfo) => {
    if (!savedUser) return;
    setError(null);
    const r = await authenticateBiometric(info.label);
    if (r.ok) unlock(savedUser);
    else if (r.message) setError(r.message);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [info, pref] = await Promise.all([biometricInfo(), getBiometricPref()]);
      if (!alive || !info.available) return;
      setBio(info);
      setBioOn(pref === 'on');
      // ao abrir a tela de login, já pede o Face ID uma vez (se cancelar, fica a senha)
      if (!setup && pref === 'on' && !autoAsked.current) {
        autoAsked.current = true;
        tryBiometric(info);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  /** Depois do 1º login com senha, oferece o Face ID (uma vez; dá para mudar em Configurações). */
  const offerBiometric = async () => {
    if (!bio || (await getBiometricPref()) !== null) return;
    Alert.alert(`Usar ${bio.label}?`, `Nas próximas vezes você pode entrar no Cypris Smile com o ${bio.label}, sem digitar a senha.`, [
      { text: 'Agora não', style: 'cancel', onPress: () => setBiometricPref('off') },
      { text: `Usar ${bio.label}`, onPress: () => setBiometricPref('on') },
    ]);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (setup) {
        const name = await createAccount(user, password, confirm);
        unlock(name);
        offerBiometric();
      } else if (await checkLogin(user, password)) {
        unlock(user.trim().toLowerCase());
        offerBiometric();
      } else {
        setError('Usuário ou senha incorretos.');
        setPassword('');
      }
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[StyleSheet.absoluteFill, styles.root]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        <Logo size={58} />
        <View style={styles.card}>
          <Text style={styles.title}>{setup ? 'Criar acesso' : 'Entrar'}</Text>
          <Text style={styles.hint}>
            {setup
              ? 'Primeiro uso: escolha um usuário e uma senha. Eles ficam guardados só neste aparelho, e o app vai pedi-los sempre que abrir.'
              : 'Use o usuário e a senha que você criou neste aparelho.'}
          </Text>
          <Text style={styles.label} nativeID="lbl-user">
            Usuário
          </Text>
          <TextInput
            value={user}
            onChangeText={setUser}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            accessibilityLabelledBy="lbl-user"
            placeholder="ex.: gustavo"
            placeholderTextColor="#A39EA3"
          />
          <Text style={styles.label} nativeID="lbl-pass">
            Senha
          </Text>
          <View style={styles.passRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={setup ? 'newPassword' : 'password'}
              accessibilityLabelledBy="lbl-pass"
              onSubmitEditing={setup ? undefined : submit}
            />
            <Pressable onPress={() => setShow(!show)} style={styles.showBtn} accessibilityRole="button" accessibilityLabel={show ? 'Esconder a senha' : 'Mostrar a senha'}>
              <Text style={styles.showText}>{show ? 'Ocultar' : 'Mostrar'}</Text>
            </Pressable>
          </View>
          {setup && (
            <>
              <Text style={[styles.label, { marginTop: spacing.md }]} nativeID="lbl-confirm">
                Repita a senha
              </Text>
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                style={styles.input}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                accessibilityLabelledBy="lbl-confirm"
                onSubmitEditing={submit}
              />
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <Button title={setup ? 'Criar acesso e entrar' : 'Entrar'} onPress={submit} loading={busy} style={{ marginTop: spacing.md }} />
          {!setup && bio && bioOn && (
            <Pressable onPress={() => tryBiometric(bio)} style={styles.bioBtn} accessibilityRole="button">
              <Text style={styles.bioText}>Entrar com {bio.label}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, zIndex: 20 },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.lg, gap: 40 },
  card: {
    maxWidth: 440,
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: { fontFamily: fonts.medium, fontSize: 20, color: colors.text, marginBottom: 6 },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: '#FFFDFC',
    marginBottom: spacing.md,
  },
  passRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  showBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 },
  showText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, marginTop: spacing.sm },
  bioBtn: {
    marginTop: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bioText: { color: colors.primaryDark, fontFamily: fonts.medium, fontSize: 16 },
});
