import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from './cx';

interface FieldShellProps { label: string; error?: string; hint?: string; required?: boolean }

const control = (error?: string) => cx(
  'w-full rounded-md border bg-surface px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
  error ? 'border-danger' : 'border-slate-300');

function Shell({ id, label, error, hint, required, children }: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}{required && <span aria-hidden className="text-danger"> *</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}

const aria = (id: string, error?: string, hint?: string) => ({
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
});

type TextFieldProps = FieldShellProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, required, className, ...rest }, ref) {
  const id = useId();
  return <Shell id={id} {...{ label, error, hint, required }}>
    <input ref={ref} id={id} required={required} className={cx(control(error), className)} {...aria(id, error, hint)} {...rest} />
  </Shell>;
});

type TextAreaFieldProps = FieldShellProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;
export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, required, className, rows = 3, ...rest }, ref) {
  const id = useId();
  return <Shell id={id} {...{ label, error, hint, required }}>
    <textarea ref={ref} id={id} rows={rows} className={cx(control(error), className)} {...aria(id, error, hint)} {...rest} />
  </Shell>;
});

type SelectFieldProps = FieldShellProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  options: readonly { value: string; label: string }[]; placeholder?: string;
};
export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, error, hint, required, options, placeholder, className, ...rest }, ref) {
  const id = useId();
  return <Shell id={id} {...{ label, error, hint, required }}>
    <select ref={ref} id={id} className={cx(control(error), className)} {...aria(id, error, hint)} {...rest}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </Shell>;
});
