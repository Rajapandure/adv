import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, DataTable, PageHeader, SelectField, TextField } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';
import { formatDateIN } from '@/domain/dates';
import { CaseEditor } from './CaseEditor';
import { CategoriesDialog } from './CategoriesDialog';

export const statusTone = (s: unknown) => (s === 'closed' ? 'neutral' : s === 'on_hold' ? 'warning' : 'success') as 'neutral' | 'warning' | 'success';

export function CasesPage() {
  const t = useT();
  const { cases, categories, courts } = useServices();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [editing, setEditing] = useState(params.get('new') === '1');
  const [managing, setManaging] = useState(false);
  const meta = useLoad(async () => ({ cats: await categories.list(), courts: await courts.list() }), []);
  const { data, error, reload } = useLoad(() => cases.list({ q, status, categoryId }), [q, status, categoryId]);
  const catName = new Map((meta.data?.cats ?? []).map((c) => [c.id, String(c.name)]));
  const courtName = new Map((meta.data?.courts ?? []).map((c) => [c.id, String(c.name)]));
  const closeEditor = () => { setEditing(false); if (params.has('new')) { params.delete('new'); setParams(params, { replace: true }); } };
  const filtered = Boolean(q || status || categoryId);

  return (
    <section>
      <PageHeader title={t('nav.cases')} actions={<><Button variant="secondary" onClick={() => setManaging(true)}>{t('cases.manageCategories')}</Button>
        <Button onClick={() => setEditing(true)}><Plus size={16} aria-hidden /> {t('cases.new')}</Button></>} />
      <div className="mb-4 grid items-end gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <TextField label={t('cases.search')} type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField label={t('f.status')} value={status} onChange={(e) => setStatus(e.target.value)}
          options={[{ value: '', label: t('cases.allStatuses') }, ...(['active', 'on_hold', 'closed'] as const).map((s) => ({ value: s, label: t(`cstatus.${s}` as MessageKey) }))]} />
        <SelectField label={t('f.category')} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
          options={[{ value: '', label: t('cases.allCategories') }, ...(meta.data?.cats ?? []).map((c) => ({ value: c.id, label: String(c.name) }))]} />
      </div>
      {error && <p role="alert" className="text-danger">{t('common.error', { msg: error.message })}</p>}
      {data && (
        <DataTable rows={data} rowKey={(r) => r.id} onRowClick={(r) => nav(`/cases/${r.id}`)}
          empty={{ title: t(filtered ? 'cases.none' : 'cases.empty.title'), hint: filtered ? undefined : t('cases.empty.hint'),
            action: filtered ? undefined : <Button onClick={() => setEditing(true)}>{t('cases.new')}</Button> }}
          columns={[
            { key: 'no', header: t('col.caseNo'), render: (r) => String(r.internal_no) },
            { key: 'title', header: t('col.title'), render: (r) => <span className="font-medium">{String(r.title)}</span> },
            { key: 'court', header: t('col.court'), render: (r) => courtName.get(r.court_id as string) ?? '—' },
            { key: 'cat', header: t('col.category'), render: (r) => catName.get(r.category_id as string) ?? '—' },
            { key: 'filed', header: t('col.filed'), render: (r) => (r.filing_date ? formatDateIN(String(r.filing_date)) : '—') },
            { key: 'st', header: t('col.status'), render: (r) => <Badge tone={statusTone(r.status)}>{t(`cstatus.${String(r.status)}` as MessageKey)}</Badge> },
          ]} />)}
      {editing && <CaseEditor initial={null} onClose={closeEditor} onSaved={(r) => nav(`/cases/${r.id}`)} />}
      {managing && <CategoriesDialog onClose={() => { setManaging(false); reload(); }} onChanged={meta.reload} />}
    </section>
  );
}
