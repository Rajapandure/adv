import type { ReactNode } from 'react';
import { cx } from './cx';

const tones = {
  neutral: 'bg-slate-100 text-slate-700', success: 'bg-success-soft text-success',
  warning: 'bg-warn-soft text-warn', danger: 'bg-danger-soft text-danger', info: 'bg-navy-50 text-navy-700',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-surface p-8 text-center">
      <h2 className="font-medium text-slate-800">{title}</h2>
      {hint && <p className="mt-1 text-sm text-slate-600">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-navy-800">{title}</h1>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
