/** Regras do acesso local (parte pura, testável). */

export const MIN_PASSWORD = 4;
/** Depois de quanto tempo em segundo plano o app volta a pedir a senha. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;

export function normalizeUser(user: string): string {
  return user.trim().toLowerCase();
}

/** Valida a criação do acesso. Devolve a mensagem de erro, ou null quando está tudo certo. */
export function validateNewAccount(user: string, password: string, confirm: string): string | null {
  if (normalizeUser(user).length < 2) return 'Escolha um nome de usuário com pelo menos 2 letras.';
  if (password.length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
  if (password !== confirm) return 'As duas senhas não são iguais.';
  return null;
}

/** Deve voltar a pedir a senha? (tempo em segundo plano maior que o limite) */
export function shouldLock(backgroundSince: number | null, now: number, limit = LOCK_AFTER_MS): boolean {
  return backgroundSince !== null && now - backgroundSince >= limit;
}
