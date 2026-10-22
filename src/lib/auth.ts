/**
 * Acesso local ao app: usuário e senha criados no primeiro uso, guardados no cofre do aparelho
 * (expo-secure-store; no navegador, AsyncStorage). A senha nunca é gravada: só o SHA-256 dela com um sal
 * aleatório. Não há servidor: o acesso vale só neste aparelho.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { normalizeUser, validateNewAccount } from './authRules';

const K = { user: 'cypris.auth.user', salt: 'cypris.auth.salt', hash: 'cypris.auth.hash', remember: 'cypris.auth.remember' };

const get = (k: string) => (Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k));
const put = (k: string, v: string) => (Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v));

const digest = (salt: string, password: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);

export async function hasAccount(): Promise<boolean> {
  return !!(await get(K.hash));
}

export async function accountUser(): Promise<string | null> {
  return get(K.user);
}

/** Cria (ou substitui) o acesso. Lança erro com a mensagem para a tela. */
export async function createAccount(user: string, password: string, confirm: string): Promise<string> {
  const err = validateNewAccount(user, password, confirm);
  if (err) throw new Error(err);
  const salt = Crypto.randomUUID();
  const name = normalizeUser(user);
  await put(K.user, name);
  await put(K.salt, salt);
  await put(K.hash, await digest(salt, password));
  return name;
}

/** Confere usuário e senha. */
export async function checkLogin(user: string, password: string): Promise<boolean> {
  const [u, salt, hash] = await Promise.all([get(K.user), get(K.salt), get(K.hash)]);
  if (!u || !salt || !hash) return false;
  if (normalizeUser(user) !== u) return false;
  return (await digest(salt, password)) === hash;
}

/** "Manter conectado neste aparelho": o app abre direto, sem pedir a senha. */
export async function getRemember(): Promise<boolean> {
  return (await get(K.remember)) === 'on';
}

export async function setRemember(on: boolean): Promise<void> {
  await put(K.remember, on ? 'on' : 'off');
}

/** Troca a senha (exige a atual). */
export async function changePassword(current: string, next: string, confirm: string): Promise<void> {
  const user = await accountUser();
  if (!user || !(await checkLogin(user, current))) throw new Error('A senha atual não confere.');
  await createAccount(user, next, confirm);
}
