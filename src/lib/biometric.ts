/**
 * Entrar com Face ID (ou digital), quando o aparelho tem e a pessoa cadastrou. É só um atalho para o login:
 * o acesso continua sendo o usuário e a senha (`auth.ts`), e a preferência fica neste aparelho.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

const PREF = 'cypris.auth.biometric';

export type BiometricInfo = { available: boolean; label: string };

/** O aparelho tem biometria cadastrada? E qual nome mostrar (Face ID, Touch ID, digital…). */
export async function biometricInfo(): Promise<BiometricInfo> {
  if (Platform.OS === 'web') return { available: false, label: 'biometria' };
  try {
    const [hw, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
    const label = face ? (Platform.OS === 'ios' ? 'Face ID' : 'reconhecimento facial') : finger ? (Platform.OS === 'ios' ? 'Touch ID' : 'digital') : 'biometria';
    return { available: hw && enrolled, label };
  } catch {
    return { available: false, label: 'biometria' };
  }
}

/** 'on' = usar; 'off' = a pessoa recusou; null = ainda não perguntamos. */
export async function getBiometricPref(): Promise<'on' | 'off' | null> {
  const v = await AsyncStorage.getItem(PREF);
  return v === 'on' || v === 'off' ? v : null;
}

export async function setBiometricPref(v: 'on' | 'off'): Promise<void> {
  await AsyncStorage.setItem(PREF, v);
}

/** Pede a biometria. `ok` false com `message` quando falhou por um motivo que vale mostrar. */
export async function authenticateBiometric(label: string): Promise<{ ok: boolean; message?: string }> {
  const r = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Entrar no Cypris Smile',
    cancelLabel: 'Usar senha',
    disableDeviceFallback: true,
  });
  if (r.success) return { ok: true };
  if (r.error === 'user_cancel' || r.error === 'system_cancel' || r.error === 'app_cancel' || r.error === 'user_fallback') return { ok: false };
  // o iOS devolve este código (fora da tipagem) quando o app não declara o uso do Face ID — caso do Expo Go
  if ((r.error as string) === 'missing_usage_description')
    return { ok: false, message: `O ${label} não fica disponível dentro do Expo Go; ele funciona no app instalado. Entre com a senha.` };
  if (r.error === 'lockout') return { ok: false, message: `${label} bloqueado por muitas tentativas. Entre com a senha.` };
  return { ok: false, message: `Não foi possível usar o ${label}. Entre com a senha.` };
}
