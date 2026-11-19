import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
const styles: Record<Variant, string> = {
  primary: 'bg-navy-700 text-white hover:bg-navy-800',
  secondary: 'border border-slate-300 bg-surface text-slate-800 hover:bg-slate-50',
  danger: 'bg-danger text-white hover:opacity-90',
  ghost: 'text-navy-700 hover:bg-navy-50',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, type = 'button', ...rest }, ref) {
  return <button ref={ref} type={type}
    className={cx('inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', styles[variant], className)}
    {...rest} />;
});
