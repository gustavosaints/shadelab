import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { checkLogin, createAccount } from '@/lib/auth';
import { useAuth } from '@/lib/AuthContext';
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

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (setup) {
        const name = await createAccount(user, password, confirm);
        unlock(name);
      } else if (await checkLogin(user, password)) {
        unlock(user.trim().toLowerCase());
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
});
