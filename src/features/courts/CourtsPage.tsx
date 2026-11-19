import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { Button, ConfirmDialog, DataTable, Modal, PageHeader, SelectField, TextAreaField, TextField, toast } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';
import type { Row } from '@/data/repositories/Repository';
import { INDIAN_STATES } from '@/domain/india';
import { courtSchema, courtToInput, type CourtInput } from '@/services/courts';

function CourtEditor({ initial, onClose, onSaved }: { initial: Row | null; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const { courts } = useServices();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CourtInput>({ resolver: zodResolver(courtSchema), defaultValues: courtToInput(initial) });
  async function submit(v: CourtInput) {
    try { if (initial) await courts.update(initial.id, v, initial.version); else await courts.create(v); toast.success(t('common.saved')); onSaved(); onClose(); }
    catch (e) { toast.error(t('common.error', { msg: (e as Error).message })); }
  }
  return (
    <Modal open title={t(initial ? 'courts.edit' : 'courts.new')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="court-form" disabled={isSubmitting}>{t('common.save')}</Button></>}>
      <form id="court-form" noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <TextField label={t('col.name')} required error={errors.name?.message ? t(errors.name.message as MessageKey) : undefined} {...register('name')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('f.courtType')} {...register('court_type')} />
          <TextField label={t('f.district')} {...register('district')} />
          <SelectField label={t('f.state')} placeholder={t('f.statePlaceholder')} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} {...register('state')} />
          <TextField label={t('f.bench')} {...register('bench')} />
          <TextField label={t('f.courtroom')} {...register('courtroom')} />
          <TextField label={t('f.judge')} {...register('judge')} />
        </div>
        <TextAreaField label={t('f.address')} rows={2} {...register('address')} />
      </form>
    </Modal>
  );
}

export function CourtsPage() {
  const t = useT();
  const { courts } = useServices();
  const { data, reload } = useLoad(() => courts.list(), []);
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);

  async function remove() {
    const c = removing; setRemoving(null);
    if (!c) return;
    try { await courts.remove(c.id); toast.success(t('courts.removed')); reload(); }
    catch (e) { toast.error((e as { code?: string }).code === 'ReferentialError' ? t('courts.inUse') : (e as Error).message); }
  }
  return (
    <section>
      <PageHeader title={t('nav.courts')} actions={<Button onClick={() => setEditing('new')}><Plus size={16} aria-hidden /> {t('courts.new')}</Button>} />
      {data && (
        <DataTable rows={data} rowKey={(r) => r.id} empty={{ title: t('courts.empty.title'), hint: t('courts.empty.hint'), action: <Button onClick={() => setEditing('new')}>{t('courts.new')}</Button> }}
          columns={[
            { key: 'n', header: t('col.name'), render: (r) => <span className="font-medium">{String(r.name)}</span> },
            { key: 't', header: t('f.courtType'), render: (r) => String(r.court_type ?? '—') },
            { key: 'd', header: t('col.district'), render: (r) => String(r.district ?? '—') },
            { key: 'r', header: t('f.courtroom'), render: (r) => String(r.courtroom ?? '—') },
            { key: 'a', header: '', render: (r) => (<span className="flex justify-end gap-3">
              <button type="button" className="text-navy-700 underline" aria-label={`${t('common.edit')} ${String(r.name)}`} onClick={() => setEditing(r)}>{t('common.edit')}</button>
              <button type="button" className="text-danger underline" aria-label={`${t('common.remove')} ${String(r.name)}`} onClick={() => setRemoving(r)}>{t('common.remove')}</button></span>) },
          ]} />)}
      {editing && <CourtEditor initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={reload} />}
      <ConfirmDialog open={Boolean(removing)} title={t('common.remove')} message={String(removing?.name ?? '')} confirmLabel={t('common.remove')} onConfirm={remove} onCancel={() => setRemoving(null)} />
    </section>
  );
}
