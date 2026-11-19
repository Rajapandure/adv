import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { TextField } from './fields';
import { formatINR, parseRupees, type Paise } from '@/domain/money';

type Props = {
  label: string; error?: string; hint?: string; required?: boolean;
  /** Controlled value in paise (null = empty). */
  value: Paise | null; onChange: (v: Paise | null) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'>;

/** Rupee text input that always yields integer paise. Shows an inline error for unparseable text. */
export const MoneyField = forwardRef<HTMLInputElement, Props>(function MoneyField(
  { value, onChange, error, label, hint, required, ...rest }, ref) {
  const [text, setText] = useState(value === null ? '' : formatINR(value, { showPaise: false }).replace('₹', ''));
  const [bad, setBad] = useState(false);
  return (
    <TextField ref={ref} label={label} hint={hint} required={required} inputMode="decimal" autoComplete="off"
      error={error ?? (bad ? 'Enter an amount like 15,000 or 15000.50' : undefined)}
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') { setBad(false); onChange(null); return; }
        const p = parseRupees(raw);
        setBad(p === null);
        if (p !== null) onChange(p);
      }}
      {...rest} />
  );
});
