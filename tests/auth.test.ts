import { describe, expect, it } from 'vitest';
import { LOCK_AFTER_MS, normalizeUser, shouldLock, validateNewAccount } from '@/lib/authRules';

describe('acesso local', () => {
  it('valida usuário, tamanho e confirmação da senha', () => {
    expect(validateNewAccount('g', '1234', '1234')).toMatch(/usuário/);
    expect(validateNewAccount('gustavo', '123', '123')).toMatch(/pelo menos/);
    expect(validateNewAccount('gustavo', '1234', '12345')).toMatch(/não são iguais/);
    expect(validateNewAccount('gustavo', '1234', '1234')).toBeNull();
  });
  it('usuário sem diferença de maiúsculas e espaços', () => {
    expect(normalizeUser('  Gustavo ')).toBe('gustavo');
  });
  it('bloqueia só depois do tempo limite em segundo plano', () => {
    expect(shouldLock(null, 10_000)).toBe(false);
    expect(shouldLock(0, LOCK_AFTER_MS - 1)).toBe(false);
    expect(shouldLock(0, LOCK_AFTER_MS)).toBe(true);
  });
});
