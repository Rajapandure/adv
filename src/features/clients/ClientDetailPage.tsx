import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge, Button, ConfirmDialog, DataTable, PageHeader, toast } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';
import { formatDateIN, formatDateTimeIN } from '@/domain/dates';
import { formatINR } from '@/domain/money';
import { ClientEditor } from './ClientEditor';

export function ClientDetailPage() {
  const t = useT();
  const { id = '' } = useParams();
  const nav = useNavigate();
  const { clients } = useServices();
  const { data, loading, reload } = useLoad(() => clients.detail(id), [id]);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (loading && !data) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  if (!data) return <p role="alert">{t('detail.notFound')} <Link className="underline" to="/clients">{t('common.back')}</Link></p>;
  const { client: c, cases, payments, totals, history } = data;
  const archived = Boolean(c.archived);

  async function toggleArchive() {
    setConfirm(false);
    await clients.setArchived(id, !archived);
    toast.success(t(archived ? 'clients.restored' : 'clients.archived'));
    reload();
  }
  const rows: [string, unknown][] = [
    [t('f.phone'), c.phone], [t('f.altPhone'), c.alt_phone], [t('f.email'), c.email],
    [t('f.address'), [c.address, c.city, c.state, c.pin].filter(Boolean).join(', ')], [t('f.notes'), c.notes],
  ];

  return (
    <section className="max-w-4xl">
      <Link to="/clients" className="mb-3 inline-flex items-center gap-1 text-sm text-navy-600 hover:underline"><ArrowLeft size={14} aria-hidden /> {t('common.back')}</Link>
      <PageHeader title={String(c.name)} actions={<>
        <Button variant="secondary" onClick={() => setEditing(true)}>{t('common.edit')}</Button>
        <Button variant={archived ? 'primary' : 'secondary'} onClick={() => (archived ? toggleArchive() : setConfirm(true))}>{t(archived ? 'common.restore' : 'common.archive')}</Button>
      </>} />
      <p className="-mt-4 mb-6 flex gap-2 text-sm text-slate-600">{String(c.client_no)} <Badge tone={archived ? 'neutral' : 'success'}>{t(archived ? 'status.archived' : 'status.active')}</Badge>
        <Badge tone="info">{t(c.type === 'organization' ? 'type.organization' : 'type.individual')}</Badge></p>

      <h2 className="mb-2 font-medium text-navy-800">{t('detail.contact')}</h2>
      <dl className="mb-8 grid gap-x-8 gap-y-2 rounded-lg border border-slate-200 bg-surface p-5 text-sm sm:grid-cols-2">
        {rows.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="text-slate-900">{String(v)}</dd></div>)}
      </dl>

      <h2 className="mb-2 font-medium text-navy-800">{t('detail.cases')}</h2>
      <div className="mb-8"><DataTable rows={cases} rowKey={(r) => r.id} onRowClick={(r) => nav(`/cases/${r.id}`)} empty={{ title: t('detail.noCases') }}
        columns={[{ key: 'no', header: t('col.caseNo'), render: (r) => String(r.internal_no) }, { key: 't', header: t('col.case'), render: (r) => String(r.title) }]} /></div>

      <h2 className="mb-2 font-medium text-navy-800">{t('detail.payments')}</h2>
      <p className="mb-2 text-sm text-slate-600">{t('detail.agreed')}: {formatINR(totals.agreed)} · {t('detail.paid')}: {formatINR(totals.paid)} · {t('detail.due')}: {formatINR(totals.outstanding)}</p>
      <div className="mb-8"><DataTable rows={payments} rowKey={(r) => r.row.id} empty={{ title: t('detail.noPayments') }}
        columns={[{ key: 'd', header: t('col.date'), render: (r) => formatDateIN(String(r.row.paid_on)) }, { key: 'r', header: t('col.receipt'), render: (r) => String(r.row.receipt_no ?? '—') },
          { key: 'a', header: t('col.amount'), render: (r) => formatINR(r.row.amount_paise as number) }]} /></div>

      <h2 className="mb-2 font-medium text-navy-800">{t('detail.history')}</h2>
      <ul className="mb-8 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-surface text-sm">
        {history.map((h) => <li key={h.id} className="flex justify-between px-4 py-2"><span>{t(`act.${h.action}` as MessageKey)}</span><span className="text-slate-500">{formatDateTimeIN(String(h.at))}</span></li>)}
      </ul>

      {editing && <ClientEditor open initial={c} onClose={() => setEditing(false)} onSaved={reload} />}
      <ConfirmDialog open={confirm} title={t('clients.archive.title')} message={t('clients.archive.body')} confirmLabel={t('common.archive')} onConfirm={toggleArchive} onCancel={() => setConfirm(false)} />
    </section>
  );
}
