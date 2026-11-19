import { NavLink, Outlet } from 'react-router-dom';
import { Languages, ShieldCheck } from 'lucide-react';
import { NAV } from './nav';
import { useLang, useT } from '@/i18n/store';
import { ToastViewport } from '@/design-system';
import { GlobalSearch } from './GlobalSearch';

const linkBase = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors';

export function Shell() {
  const t = useT();
  const toggle = useLang((s) => s.toggle);

  return (
    <div className="flex min-h-screen">
      <ToastViewport />
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-900 text-navy-100 md:flex">
        <div className="px-5 py-5 text-lg font-semibold text-white">{t('appName')}</div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `${linkBase} ${isActive ? 'bg-navy-700 text-white' : 'hover:bg-navy-800'}`}>
              <Icon size={18} aria-hidden /> {t(label)}
            </NavLink>
          ))}
        </nav>
        <p className="flex items-center gap-2 px-5 py-4 text-xs text-navy-200">
          <ShieldCheck size={14} aria-hidden /> {t('privacy.note')}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-surface px-4 py-3 md:px-8">
          <GlobalSearch />
          <span className="mr-3 hidden rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success lg:inline">
            {t('offline.badge')}
          </span>
          <button type="button" onClick={toggle} aria-label={t('lang.label')}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            <Languages size={16} aria-hidden /> {t('lang.switch')}
          </button>
        </header>
        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8"><Outlet /></main>
      </div>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {NAV.filter((n) => n.mobile).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2 text-xs ${isActive ? 'text-navy-700 font-semibold' : 'text-slate-500'}`}>
            <Icon size={20} aria-hidden /> {t(label)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
