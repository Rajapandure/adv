import { useT } from '@/i18n/store';
import type { MessageKey } from '@/i18n/messages';

export function ModulePending({ label, stage }: { label: MessageKey; stage: string }) {
  const t = useT();
  return (
    <section className="max-w-xl">
      <h1 className="text-2xl font-semibold text-navy-800">{t(label)}</h1>
      <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-surface p-6">
        <h2 className="font-medium text-slate-800">{t('stage.title')}</h2>
        <p className="mt-1 text-sm text-slate-600">{t('stage.body', { stage })}</p>
      </div>
    </section>
  );
}
