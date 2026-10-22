import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { accountUser, getRemember, hasAccount, setRemember as saveRemember } from './auth';
import { shouldLock } from './authRules';

export type AuthStatus = 'checking' | 'setup' | 'locked' | 'unlocked';

type Ctx = {
  status: AuthStatus;
  user: string | null;
  /** Manter conectado neste aparelho (não pede a senha ao abrir nem ao voltar do segundo plano). */
  remember: boolean;
  unlock: (user: string, remember?: boolean) => void;
  setRemember: (on: boolean) => void;
  /** Sair: volta para a tela de login e desliga o "manter conectado". */
  lock: () => void;
};

const AuthCtx = createContext<Ctx>({
  status: 'checking',
  user: null,
  remember: false,
  unlock: () => undefined,
  setRemember: () => undefined,
  lock: () => undefined,
});

/**
 * Estado do acesso: no primeiro uso pede para criar usuário e senha; depois pede o login ao abrir (e quando volta
 * de mais de 5 minutos em segundo plano), a menos que "Manter conectado neste aparelho" esteja ligado
 * (pedido do Gustavo, 2026-10-22).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<string | null>(null);
  const [remember, setRememberState] = useState(false);
  const rememberRef = useRef(false);
  const backgroundSince = useRef<number | null>(null);

  const applyRemember = (on: boolean) => {
    rememberRef.current = on;
    setRememberState(on);
    saveRemember(on);
  };

  useEffect(() => {
    (async () => {
      const has = await hasAccount();
      const keep = has && (await getRemember());
      rememberRef.current = keep;
      setRememberState(keep);
      setUser(await accountUser());
      setStatus(!has ? 'setup' : keep ? 'unlocked' : 'locked');
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') {
        if (backgroundSince.current === null) backgroundSince.current = Date.now();
      } else if (s === 'active') {
        if (!rememberRef.current && shouldLock(backgroundSince.current, Date.now())) setStatus((st) => (st === 'unlocked' ? 'locked' : st));
        backgroundSince.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const value: Ctx = {
    status,
    user,
    remember,
    unlock: (u, keep) => {
      setUser(u);
      if (keep !== undefined) applyRemember(keep);
      setStatus('unlocked');
    },
    setRemember: applyRemember,
    lock: () => {
      applyRemember(false);
      setStatus('locked');
    },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
