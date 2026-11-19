import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Badge, Button, ConfirmDialog, EmptyState, PageHeader, SelectField, TextField, toast } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';
import { formatDateIN } from '@/domain/dates';
import { PARTY_SIDES } from '@/services/cases';
import { CaseEditor } from './CaseEditor';
import { statusTone } from './CasesPage';

type Tab = 'overview' | 'people' | 'connected';
type Pending = { kind: 'client' | 'party' | 'connected'; id: string } | null;

export function CaseDetailPage() {
  const t = useT();
  const { id = '' } = useParams();
  const { cases, clients } = useServices();
  const { data, loading, reload } = useLoad(() => cases.detail(id), [id]);
  const lists = useLoad(async () => ({ clients: await clients.list(), cases: await cases.list() }), [id]);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [clientId, setClientId] = useState(''); const [role, setRole] = useState('petitioner');
  const [partyName, setPartyName] = useState(''); const [side, setSide] = useState('respondent'); const [adv, setAdv] = useState('');
  const [otherCase, setOtherCase] = useState('');

  if (loading && !data) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  if (!data) return <p role="alert">{t('case.notFound')} <Link className="underline" to="/cases">{t('common.back')}</Link></p>;
  const c = data.case;
  const closed = c.status === 'closed';
  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    try { await fn(); if (ok) toast.success(ok); reload(); lists.reload(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const linkedIds = new Set(data.clients.map((x) => x.client.id));
  const sideOptions = PARTY_SIDES.map((s) => ({ value: s, label: t(`side.${s}` as MessageKey) }));
  const field = (label: string, v: unknown) => (v ? <div key={label}><dt className="text-slate-500">{label}</dt><dd className="text-slate-900">{String(v)}</dd></div> : null);

  async function confirmRemove() {
    const p = pending; setPending(null);
    if (!p) return;
    if (p.kind === 'client') await run(() => cases.removeClient(p.id, id));
    else if (p.kind === 'party') await run(() => cases.removeParty(p.id, id));
    else await run(() => cases.disconnect(id, p.id));
  }
  const tabs: Tab[] = ['overview', 'people', 'connected'];
  const remove = (kind: 'client' | 'party' | 'connected', rid: string, name: string) =>
    <button type="button" className="text-danger underline" aria-label={`${t('case.remove')} ${name}`} onClick={() => setPending({ kind, id: rid })}>{t('case.remove')}</button>;

  return (
    <section className="max-w-4xl">
      <Link to="/cases" className="mb-3 inline-flex items-center gap-1 text-sm text-navy-600 hover:underline"><ArrowLeft size={14} aria-hidden /> {t('common.back')}</Link>
      <PageHeader title={String(c.title)} actions={<>
        <Button variant="secondary" onClick={() => setEditing(true)}>{t('common.edit')}</Button>
        <Button variant="secondary" onClick={() => run(() => cases.setStatus(id, closed ? 'active' : 'closed'))}>{t(closed ? 'case.reopen' : 'case.close')}</Button></>} />
      <p className="-mt-4 mb-4 flex flex-wrap gap-2 text-sm text-slate-600">{String(c.internal_no)}
        <Badge tone={statusTone(c.status)}>{t(`cstatus.${String(c.status)}` as MessageKey)}</Badge>{data.category && <Badge tone="info">{String(data.category.name)}</Badge>}</p>

      <div role="tablist" className="mb-6 flex gap-1 border-b border-slate-200">
        {tabs.map((k) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-navy-700 text-navy-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t(`tab.${k}` as MessageKey)}</button>))}
      </div>

      {tab === 'overview' && (<>
        <dl className="mb-8 grid gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-surface p-5 text-sm sm:grid-cols-2">
          {field(t('f.regNo'), c.reg_no)}{field(t('f.year'), c.case_year)}{field(t('f.cnr'), c.cnr)}{field(t('f.caseType'), c.case_type)}
          {field(t('f.court'), data.court?.name)}{field(t('f.district'), c.district)}{field(t('f.judge'), c.judge)}
          {field(t('f.filingDate'), c.filing_date && formatDateIN(String(c.filing_date)))}{field(t('f.petitioner'), c.petitioner)}{field(t('f.respondent'), c.respondent)}
          {field(t('f.stage'), c.stage)}{field(t('f.description'), c.description)}
        </dl>
        <h2 className="mb-2 font-medium text-navy-800">{t('case.timeline')}</h2>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-surface text-sm">
          {data.events.map((e) => <li key={e.id} className="flex justify-between px-4 py-2"><span>{String(e.text)}</span><span className="text-slate-500">{formatDateIN(String(e.event_date))}</span></li>)}
        </ul>
      </>)}

      {tab === 'people' && (<>
        <h2 className="mb-2 font-medium text-navy-800">{t('case.clients')}</h2>
        {data.clients.length === 0 ? <EmptyState title={t('case.noClients')} /> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-surface text-sm">
            {data.clients.map(({ link, client }) => (
              <li key={link.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span><Link className="font-medium text-navy-700 hover:underline" to={`/clients/${client.id}`}>{String(client.name)}</Link>
                  {link.role ? <span className="ml-2 text-slate-500">{t(`side.${String(link.role)}` as MessageKey)}</span> : null}</span>
                {remove('client', link.id, String(client.name))}
              </li>))}
          </ul>)}
        <div className="mb-8 mt-3 grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <SelectField label={t('case.chooseClient')} value={clientId} onChange={(e) => setClientId(e.target.value)}
            options={[{ value: '', label: '—' }, ...(lists.data?.clients ?? []).filter((x) => !linkedIds.has(x.id)).map((x) => ({ value: x.id, label: String(x.name) }))]} />
          <SelectField label={t('case.role')} value={role} onChange={(e) => setRole(e.target.value)} options={sideOptions} />
          <Button disabled={!clientId} onClick={() => run(async () => { await cases.addClient(id, clientId, role); setClientId(''); })}>{t('case.addClient')}</Button>
        </div>

        <h2 className="mb-2 font-medium text-navy-800">{t('case.parties')}</h2>
        {data.parties.length === 0 ? <EmptyState title={t('case.noParties')} /> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-surface text-sm">
            {data.parties.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span><span className="font-medium">{String(p.name)}</span> <Badge>{t(`side.${String(p.side)}` as MessageKey)}</Badge>
                  {p.advocate_name ? <span className="ml-2 text-slate-500">{String(p.advocate_name)}</span> : null}</span>
                {remove('party', p.id, String(p.name))}
              </li>))}
          </ul>)}
        <div className="mt-3 grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
          <TextField label={t('col.name')} value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          <SelectField label={t('case.side')} value={side} onChange={(e) => setSide(e.target.value)} options={sideOptions} />
          <TextField label={t('case.advocate')} value={adv} onChange={(e) => setAdv(e.target.value)} />
          <Button disabled={partyName.trim().length < 2} onClick={() => run(async () => { await cases.addParty(id, { name: partyName, side, advocate_name: adv }); setPartyName(''); setAdv(''); })}>{t('case.addParty')}</Button>
        </div>
      </>)}

      {tab === 'connected' && (<>
        {data.connected.length === 0 ? <EmptyState title={t('case.noConnected')} /> : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-surface text-sm">
            {data.connected.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <Link className="text-navy-700 hover:underline" to={`/cases/${x.id}`}>{String(x.internal_no)} · {String(x.title)}</Link>
                {remove('connected', x.id, String(x.title))}
              </li>))}
          </ul>)}
        <div className="mt-3 grid items-end gap-3 sm:grid-cols-[3fr_auto]">
          <SelectField label={t('case.chooseCase')} value={otherCase} onChange={(e) => setOtherCase(e.target.value)}
            options={[{ value: '', label: '—' }, ...(lists.data?.cases ?? []).filter((x) => x.id !== id && !data.connected.some((k) => k.id === x.id)).map((x) => ({ value: x.id, label: `${String(x.internal_no)} · ${String(x.title)}` }))]} />
          <Button disabled={!otherCase} onClick={() => run(async () => { await cases.connect(id, otherCase); setOtherCase(''); })}>{t('case.connectCase')}</Button>
        </div>
      </>)}

      {editing && <CaseEditor initial={c} onClose={() => setEditing(false)} onSaved={() => { reload(); lists.reload(); }} />}
      <ConfirmDialog open={Boolean(pending)} title={t('case.remove')} message={t('case.removeConfirm')} confirmLabel={t('case.remove')} onConfirm={confirmRemove} onCancel={() => setPending(null)} />
    </section>
  );
}
