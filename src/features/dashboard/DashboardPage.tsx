import { Link } from 'react-router-dom';
import { Gavel, UserPlus } from 'lucide-react';
import { PageHeader } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';
import { formatDateTimeIN, todayISO } from '@/domain/dates';
import { formatINR } from '@/domain/money';

export function DashboardPage() {
  const t = useT();
  const { dashboard } = useServices();
  const { data: s, error } = useLoad(() => dashboard.stats(todayISO()), []);
  if (error) return <p role="alert" className="text-danger">{t('common.error', { msg: error.message })}</p>;
  if (!s) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;

  const cards: [MessageKey, string | number][] = [
    ['dash.clients', s.clients], ['dash.activeCases', s.activeCases], ['dash.closedCases', s.closedCases],
    ['dash.todayHearings', s.todaysHearings], ['dash.upcoming', s.upcomingHearings], ['dash.pendingTasks', s.pendingTasks],
    ['dash.outstanding', formatINR(s.outstandingPaise)], ['dash.monthly', formatINR(s.monthlyCollectionPaise)],
  ];
  return (
    <section className="max-w-5xl">
      <PageHeader title={t('nav.dashboard')} />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-surface p-4">
            <dt className="text-xs text-slate-500">{t(k)}</dt>
            <dd className="mt-1 text-2xl font-semibold text-navy-800">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div>
          <h2 className="mb-2 font-medium text-navy-800">{t('dash.quick')}</h2>
          <Link to="/clients?new=1" className="inline-flex items-center gap-2 rounded-md bg-navy-700 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800">
            <UserPlus size={16} aria-hidden /> {t('dash.addClient')}
          </Link>
          <Link to="/cases?new=1" className="mt-2 flex w-fit items-center gap-2 rounded-md border border-slate-300 bg-surface px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
            <Gavel size={16} aria-hidden /> {t('cases.new')}
          </Link>
        </div>
        <div className="md:col-span-2">
          <h2 className="mb-2 font-medium text-navy-800">{t('dash.recent')}</h2>
          {s.recent.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 bg-surface p-4 text-sm text-slate-600">{t('dash.recent.empty')}</p> : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-surface text-sm">
              {s.recent.map((a) => <li key={a.id} className="flex justify-between px-4 py-2"><span>{t(`act.${a.action}` as MessageKey)}</span><span className="text-slate-500">{formatDateTimeIN(String(a.at))}</span></li>)}
            </ul>)}
        </div>
      </div>
    </section>
  );
}
