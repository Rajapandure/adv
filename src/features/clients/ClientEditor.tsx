import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, ConfirmDialog, Modal, SelectField, TextAreaField, TextField, toast } from '@/design-system';
import { useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';
import { clientSchema, toInput, type ClientInput } from '@/services/clients';
import type { Row } from '@/data/repositories/Repository';
import { INDIAN_STATES } from '@/domain/india';

/** Create/edit dialog with validation, duplicate-phone warning and clear success/failure feedback. */
export function ClientEditor({ open, initial, onClose, onSaved }: {
  open: boolean; initial: Row | null; onClose: () => void; onSaved: (row: Row) => void;
}) {
  const t = useT();
  const { clients } = useServices();
  const [draft, setDraft] = useState<ClientInput | null>(null);
  const [dup, setDup] = useState<{ values: ClientInput; name: string } | null>(null);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ClientInput>({
    resolver: zodResolver(clientSchema), defaultValues: draft ?? toInput(initial),
  });
  const err = (m?: string) => (m ? t(m as MessageKey) : undefined);
  const isOrg = watch('type') === 'organization';

  async function save(values: ClientInput) {
    try {
      const row = initial ? await clients.update(initial.id, values, initial.version) : await clients.create(values);
      toast.success(t('clients.saved'));
      setDraft(null); setDup(null);
      onSaved(row); onClose();
    } catch (e) {
      const code = (e as { code?: string }).code;
      toast.error(code === 'ConflictError' ? t('clients.conflict') : t('common.error', { msg: (e as Error).message }));
    }
  }

  async function submit(values: ClientInput) {
    const found = await clients.findDuplicates(values.phone, initial?.id);
    if (found.length) { setDup({ values, name: String(found[0].name) }); return; }
    await save(values);
  }

  return (
    <>
      <Modal open={open && !dup} title={t(initial ? 'clients.edit' : 'clients.new')} onClose={onClose}
        footer={<><Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" form="client-form" disabled={isSubmitting}>{t('common.save')}</Button></>}>
        <form id="client-form" noValidate onSubmit={handleSubmit(submit)} className="flex flex-col gap-4">
          <SelectField label={t('f.type')} options={[{ value: 'individual', label: t('type.individual') }, { value: 'organization', label: t('type.organization') }]} {...register('type')} />
          <TextField label={t(isOrg ? 'f.orgName' : 'f.name')} required autoComplete="off" error={err(errors.name?.message)} {...register('name')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label={t('f.phone')} required inputMode="tel" hint={t('f.phoneHint')} error={err(errors.phone?.message)} {...register('phone')} />
            <TextField label={t('f.altPhone')} inputMode="tel" error={err(errors.alt_phone?.message)} {...register('alt_phone')} />
          </div>
          <TextField label={t('f.email')} type="email" error={err(errors.email?.message)} {...register('email')} />
          <TextAreaField label={t('f.address')} rows={2} {...register('address')} />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label={t('f.city')} {...register('city')} />
            <SelectField label={t('f.state')} placeholder={t('f.statePlaceholder')} options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} {...register('state')} />
            <TextField label={t('f.pin')} inputMode="numeric" maxLength={6} error={err(errors.pin?.message)} {...register('pin')} />
          </div>
          <TextAreaField label={t('f.notes')} {...register('notes')} />
        </form>
      </Modal>
      <ConfirmDialog open={open && Boolean(dup)} title={t('clients.dup.title')} message={t('clients.dup.body', { name: dup?.name ?? '' })}
        confirmLabel={t('clients.dup.confirm')} onConfirm={() => dup && save(dup.values)} onCancel={() => { setDraft(dup?.values ?? null); setDup(null); }} />
    </>
  );
}
