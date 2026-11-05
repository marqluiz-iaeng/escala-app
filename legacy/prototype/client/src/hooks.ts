import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import type { Me, Meta } from './types';

export type AppContextValue = {
  me: Me | null;
  meta: Meta;
  refreshMe: () => Promise<void>;
  setMe: (me: Me | null) => void;
  toast: (message: string, tone?: 'ok' | 'error') => void;
  logout: () => Promise<void>;
};

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppContext ausente');
  return value;
}

export function useMe(): Me {
  const { me } = useApp();
  if (!me) throw new Error('Sessão ausente');
  return me;
}

function currentHash() {
  return window.location.hash.replace(/^#\/?/, '');
}

export function useRoute(): string[] {
  const [hash, setHash] = useState(currentHash);
  useEffect(() => {
    const onChange = () => {
      setHash(currentHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.split('/').filter(Boolean);
}

export function go(path: string) {
  window.location.hash = `/${path}`;
}

/** Busca dados e mantém o resultado anterior na tela enquanto recarrega, para não piscar. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const result = await fnRef.current();
      if (ticket === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (ticket === latest.current) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar.');
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => { latest.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

/** Executa uma ação da API cuidando de carregamento, erros de campo e aviso na tela. */
export function useAction() {
  const { toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    setBusy(true);
    setFields({});
    try {
      return await action();
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields);
        if (Object.keys(err.fields).length === 0 || err.fields._) toast(err.message, 'error');
      } else {
        toast('Algo deu errado. Tente de novo.', 'error');
      }
      return null;
    } finally {
      setBusy(false);
    }
  }, [toast]);

  return { busy, fields, setFields, run };
}
