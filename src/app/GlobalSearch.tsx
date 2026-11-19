import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useServices } from './DataProvider';
import { useT } from '@/i18n/store';
import type { SearchHit } from '@/services/search';

export function GlobalSearch() {
  const t = useT();
  const { search } = useServices();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let live = true;
    const h = setTimeout(() => { search.search(q).then((r) => live && setHits(r), () => live && setHits([])); }, 150);
    return () => { live = false; clearTimeout(h); };
  }, [q, search]);

  const go = (hit: SearchHit) => { setOpen(false); setQ(''); nav(hit.route); };
  return (
    <div className="relative mx-3 min-w-0 flex-1 md:max-w-md">
      <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
      <input type="search" value={q} aria-label={t('search.label')} placeholder={t('search.placeholder')}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className="w-full rounded-md border border-slate-300 bg-surface py-2 pl-9 pr-3 text-sm" />
      {open && q.trim().length >= 2 && (
        <ul role="listbox" aria-label={t('search.label')} className="absolute z-30 mt-1 max-h-80 w-full overflow-auto rounded-md border border-slate-200 bg-surface shadow-lg">
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">{t('search.none')}</li>}
          {hits.map((h) => (
            <li key={`${h.type}-${h.id}`} role="option" aria-selected={false} tabIndex={0} onClick={() => go(h)} onKeyDown={(e) => e.key === 'Enter' && go(h)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-navy-50">
              <span className="font-medium text-slate-900">{h.title}</span>
              <span className="ml-2 text-xs uppercase text-slate-400">{h.type}</span>
              {h.subtitle && <span className="block text-xs text-slate-500">{h.subtitle}</span>}
            </li>))}
        </ul>)}
    </div>
  );
}
