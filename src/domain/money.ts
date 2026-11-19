/** All money is an integer number of paise. Never use floats for arithmetic. */
export type Paise = number;

export function assertPaise(v: number): asserts v is Paise {
  if (!Number.isSafeInteger(v)) throw new Error(`Amount must be an integer number of paise, got ${v}`);
}

/** Parse "1,25,000.50" or "500" into paise. Returns null for invalid input. */
export function parseRupees(input: string): Paise | null {
  const s = input.replace(/[,\s₹]/g, '');
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const paise = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0') || 0);
  if (!Number.isSafeInteger(paise)) return null;
  return m[1] ? -paise : paise;
}

/** Format paise as Indian-grouped rupees, e.g. 12500050 -> "₹1,25,000.50". */
export function formatINR(paise: Paise, opts: { showPaise?: boolean } = {}): string {
  assertPaise(paise);
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const whole = new Intl.NumberFormat('en-IN').format(Math.floor(abs / 100));
  const frac = abs % 100;
  const showPaise = opts.showPaise ?? frac !== 0;
  const tail = showPaise ? `.${String(frac).padStart(2, '0')}` : '';
  return `${neg ? '-' : ''}₹${whole}${tail}`;
}

export function sumPaise(values: readonly Paise[]): Paise {
  return values.reduce((a, b) => {
    assertPaise(b);
    return a + b;
  }, 0);
}

/** Split a total into n instalments that add up exactly; remainder paise go to the first ones. */
export function splitInstalments(total: Paise, n: number): Paise[] {
  assertPaise(total);
  if (!Number.isInteger(n) || n < 1) throw new Error('Instalment count must be a positive integer');
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}
