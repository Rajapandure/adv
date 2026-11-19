import { useState } from 'react';
import { Button, Modal, TextField, toast } from '@/design-system';
import { useLoad, useServices } from '@/app/DataProvider';
import { useT } from '@/i18n/store';

export function CategoriesDialog({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const t = useT();
  const { categories } = useServices();
  const { data, reload } = useLoad(() => categories.list(), []);
  const [name, setName] = useState('');

  async function add() {
    if (name.trim().length < 2) return;
    await categories.add(name); setName(''); reload(); onChanged();
  }
  async function remove(id: string) {
    try { await categories.remove(id); toast.success(t('cat.removed')); reload(); onChanged(); }
    catch (e) { toast.error((e as { code?: string }).code === 'ReferentialError' ? t('cat.inUse') : (e as Error).message); }
  }
  return (
    <Modal open title={t('cat.title')} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      <ul className="mb-4 divide-y divide-slate-100 text-sm">
        {(data ?? []).map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2">
            <span>{String(c.name)}</span>
            <button type="button" className="text-danger underline" aria-label={`${t('common.remove')} ${String(c.name)}`} onClick={() => remove(c.id)}>{t('common.remove')}</button>
          </li>))}
      </ul>
      <div className="flex items-end gap-2">
        <div className="flex-1"><TextField label={t('cat.name')} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void add(); } }} /></div>
        <Button onClick={add}>{t('cat.add')}</Button>
      </div>
    </Modal>
  );
}
