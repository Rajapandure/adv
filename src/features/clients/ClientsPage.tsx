import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Badge, Button, DataTable, PageHeader, TextField } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import { ClientEditor } from './ClientEditor';

export function ClientsPage() {
  const t = useT();
  const { clients } = useServices();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState(params.get('new') === '1');
  const { data, error, loading, reload } = useLoad(() => clients.list({ q, includeArchived: showArchived }), [q, showArchived]);
  const closeEditor = () => { setEditing(false); if (params.has('new')) { params.delete('new'); setParams(params, { replace: true }); } };

  return (
    <section>
      <PageHeader title={t('nav.clients')} actions={<Button onClick={() => setEditing(true)}><Plus size={16} aria-hidden /> {t('clients.new')}</Button>} />
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1"><TextField label={t('clients.search')} type="search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> {t('clients.showArchived')}
        </label>
      </div>
      {error && <p role="alert" className="text-danger">{t('common.error', { msg: error.message })}</p>}
      {loading && !data && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {data && (
        <DataTable rows={data} rowKey={(r) => r.id} onRowClick={(r) => nav(`/clients/${r.id}`)}
          empty={{ title: t(q ? 'clients.none' : 'clients.empty.title'), hint: q ? undefined : t('clients.empty.hint'),
            action: q ? undefined : <Button onClick={() => setEditing(true)}>{t('clients.new')}</Button> }}
          columns={[
            { key: 'no', header: t('col.clientNo'), render: (r) => String(r.client_no ?? '') },
            { key: 'name', header: t('col.name'), render: (r) => <span className="font-medium">{String(r.name)} {r.type === 'organization' && <Badge tone="info">{t('type.organization')}</Badge>}</span> },
            { key: 'phone', header: t('col.phone'), render: (r) => String(r.phone) },
            { key: 'city', header: t('col.city'), render: (r) => String(r.city ?? '—') },
            { key: 'st', header: t('col.status'), render: (r) => <Badge tone={r.archived ? 'neutral' : 'success'}>{t(r.archived ? 'status.archived' : 'status.active')}</Badge> },
          ]} />
      )}
      {editing && <ClientEditor open initial={null} onClose={closeEditor} onSaved={reload} />}
    </section>
  );
}
