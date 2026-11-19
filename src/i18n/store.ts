import { create } from 'zustand';
import { messages, type Lang, type MessageKey } from './messages';

const KEY = 'advocate-crm:lang';

function load(): Lang {
  try {
    return localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

interface LangState { lang: Lang; toggle: () => void }

export const useLang = create<LangState>((set, get) => ({
  lang: load(),
  toggle: () => {
    const next: Lang = get().lang === 'en' ? 'hi' : 'en';
    try { localStorage.setItem(KEY, next); } catch { /* preference only; safe to ignore */ }
    document.documentElement.lang = next;
    set({ lang: next });
  },
}));

export function useT() {
  const lang = useLang((s) => s.lang);
  return (key: MessageKey, vars?: Record<string, string>) => {
    let s: string = messages[lang][key] ?? key; // unknown dynamic keys (e.g. future audit actions) show their id
    for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, v);
    return s;
  };
}
