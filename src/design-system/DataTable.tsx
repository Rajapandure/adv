import type { ReactNode } from 'react';
import { EmptyState } from './misc';

export interface Column<T> { key: string; header: string; render: (row: T) => ReactNode; className?: string }

/** Table on wide screens; each row becomes a labelled card on phones. */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, empty }: {
  rows: readonly T[]; columns: readonly Column<T>[]; rowKey: (r: T) => string;
  onRowClick?: (r: T) => void; empty: { title: string; hint?: string; action?: ReactNode };
}) {
  if (rows.length === 0) return <EmptyState {...empty} />;
  const activate = (r: T) => onRowClick && { tabIndex: 0, role: 'button' as const,
    onClick: () => onRowClick(r), onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter') onRowClick(r); } };
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>
            {columns.map((c) => <th key={c.key} scope="col" className="px-4 py-2.5 font-medium">{c.header}</th>)}
          </tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={rowKey(r)} className={`border-t border-slate-100 ${onRowClick ? 'cursor-pointer hover:bg-navy-50' : ''}`} {...activate(r)}>
              {columns.map((c) => <td key={c.key} className={`px-4 py-2.5 ${c.className ?? ''}`}>{c.render(r)}</td>)}
            </tr>))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-lg border border-slate-200 bg-surface p-4" {...activate(r)}>
            <dl className="flex flex-col gap-1.5">
              {columns.map((c) => (
                <div key={c.key} className="flex justify-between gap-4 text-sm">
                  <dt className="text-slate-500">{c.header}</dt><dd className="text-right text-slate-900">{c.render(r)}</dd>
                </div>))}
            </dl>
          </li>))}
      </ul>
    </>
  );
}
