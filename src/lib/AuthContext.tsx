import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { accountUser, hasAccount } from './auth';
import { shouldLock } from './authRules';

export type AuthStatus = 'checking' | 'setup' | 'locked' | 'unlocked';

type Ctx = { status: AuthStatus; user: string | null; unlock: (user: string) => void; lock: () => void };

const AuthCtx = createContext<Ctx>({ status: 'checking', user: null, unlock: () => undefined, lock: () => undefined });

/**
 * Estado do acesso: no primeiro uso pede para criar usuário e senha; depois, toda vez que o app abre
 * (e quando volta de mais de 5 minutos em segundo plano), pede o login.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<string | null>(null);
  const backgroundSince = useRef<number | null>(null);

  useEffect(() => {
    (async () => {
      const has = await hasAccount();
      setUser(await accountUser());
      setStatus(has ? 'locked' : 'setup');
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        if (backgroundSince.current === null) backgroundSince.current = Date.now();
      } else if (s === 'active') {
        if (shouldLock(backgroundSince.current, Date.now())) setStatus((st) => (st === 'unlocked' ? 'locked' : st));
        backgroundSince.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const value: Ctx = {
    status,
    user,
    unlock: (u) => {
      setUser(u);
      setStatus('unlocked');
    },
    lock: () => setStatus('locked'),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
