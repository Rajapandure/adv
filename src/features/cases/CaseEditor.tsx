import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Modal, SelectField, TextAreaField, TextField, toast } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';
import type { Row } from '@/data/repositories/Repository';
import { CASE_STATUSES, caseSchema, caseToInput, type CaseInput } from '@/services/cases';

export function CaseEditor({ initial, onClose, onSaved }: { initial: Row | null; onClose: () => void; onSaved: (r: Row) => void }) {
  const t = useT();
  const { cases, categories, courts, clients } = useServices();
  const { data: lists } = useLoad(async () => ({ cats: await categories.list(), courts: await courts.list(), clients: initial ? [] : await clients.list() }), []);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CaseInput>({ resolver: zodResolver(caseSchema), defaultValues: caseToInput(initial) });
  const err = (m?: string) => (m ? t(m as MessageKey) : undefined);
  const none = { value: '', label: t('f.none') };

  async function submit(v: CaseInput) {
    try {
      const row = initial ? await cases.update(initial.id, v, initial.version) : await cases.create(v);
      toast.success(t('cases.saved'));
      onSaved(row); onClose();
    } catch (e) {
      toast.error((e as { code?: string }).code === 'ConflictError' ? t('clients.conflict') : t('common.error', { msg: (e as Error).message }));
    }
  }

  return (
    <Modal open title={t(initial ? 'cases.edit' : 'cases.new')} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button><Button type="submit" form="case-form" disabled={isSubmitting}>{t('common.save')}</Button></>}>
      <form id="case-form" noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
        <TextField label={t('f.title')} required error={err(errors.title?.message)} {...register('title')} />
        {!initial && <SelectField label={t('f.client')} options={[none, ...(lists?.clients ?? []).map((c) => ({ value: c.id, label: `${String(c.name)} (${String(c.client_no)})` }))]} {...register('client_id')} />}
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label={t('f.regNo')} {...register('reg_no')} />
          <TextField label={t('f.year')} inputMode="numeric" maxLength={4} error={err(errors.case_year?.message)} {...register('case_year')} />
          <TextField label={t('f.cnr')} maxLength={16} error={err(errors.cnr?.message)} {...register('cnr')} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label={t('f.category')} options={[none, ...(lists?.cats ?? []).map((c) => ({ value: c.id, label: String(c.name) }))]} {...register('category_id')} />
          <TextField label={t('f.caseType')} {...register('case_type')} />
          <SelectField label={t('f.court')} options={[none, ...(lists?.courts ?? []).map((c) => ({ value: c.id, label: String(c.name) }))]} {...register('court_id')} />
          <TextField label={t('f.district')} {...register('district')} />
          <TextField label={t('f.judge')} {...register('judge')} />
          <TextField label={t('f.filingDate')} type="date" error={err(errors.filing_date?.message)} {...register('filing_date')} />
          <TextField label={t('f.petitioner')} {...register('petitioner')} />
          <TextField label={t('f.respondent')} {...register('respondent')} />
          <TextField label={t('f.stage')} {...register('stage')} />
          <SelectField label={t('f.status')} options={CASE_STATUSES.map((s) => ({ value: s, label: t(`cstatus.${s}` as MessageKey) }))} {...register('status')} />
        </div>
        <TextAreaField label={t('f.description')} {...register('description')} />
      </form>
    </Modal>
  );
}
