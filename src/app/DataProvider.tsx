import { createContext, useContext, useEffect, useState, type DependencyList, type ReactNode } from 'react';
import { createServices, type Services } from '@/services';
import type { Repository } from '@/data/repositories/Repository';

const Ctx = createContext<Services | null>(null);

export function DataProvider({ repo, children }: { repo: Repository; children: ReactNode }) {
  const [services] = useState(() => createServices(repo));
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}
export function useServices(): Services {
  const s = useContext(Ctx);
  if (!s) throw new Error('useServices must be used inside <DataProvider>');
  return s;
}

/** Small async loader: re-runs when deps change or reload() is called. */
export function useLoad<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    fn().then((data) => live && setState({ data, error: null, loading: false }),
      (error: Error) => live && setState({ data: null, error, loading: false }));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((n) => n + 1) };
}
