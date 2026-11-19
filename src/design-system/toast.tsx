import { create } from 'zustand';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cx } from './cx';

type Kind = 'success' | 'warning' | 'error';
interface Toast { id: number; kind: Kind; text: string }
interface State { toasts: Toast[]; push: (kind: Kind, text: string) => void; dismiss: (id: number) => void }

let next = 1;
export const useToasts = create<State>((set, get) => ({
  toasts: [],
  push: (kind, text) => {
    const id = next++;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    if (typeof window !== 'undefined' && kind !== 'error') setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  success: (t: string) => useToasts.getState().push('success', t),
  warning: (t: string) => useToasts.getState().push('warning', t),
  error: (t: string) => useToasts.getState().push('error', t),
};

const look = {
  success: { cls: 'bg-success-soft text-success', Icon: CheckCircle2 },
  warning: { cls: 'bg-warn-soft text-warn', Icon: AlertTriangle },
  error: { cls: 'bg-danger-soft text-danger', Icon: XCircle },
} as const;

export function ToastViewport() {
  const { toasts, dismiss } = useToasts();
  return (
    <div role="status" aria-live="polite" className="fixed bottom-20 right-4 z-50 flex max-w-sm flex-col gap-2 md:bottom-4">
      {toasts.map(({ id, kind, text }) => {
        const { cls, Icon } = look[kind];
        return (
          <div key={id} className={cx('flex items-start gap-2 rounded-md px-4 py-3 text-sm shadow-md', cls)}>
            <Icon size={18} aria-hidden className="mt-0.5 shrink-0" />
            <span className="flex-1">{text}</span>
            <button type="button" onClick={() => dismiss(id)} aria-label="Dismiss" className="text-xs underline">Dismiss</button>
          </div>
        );
      })}
    </div>
  );
}
