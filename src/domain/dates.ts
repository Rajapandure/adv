/** Calendar dates are plain "YYYY-MM-DD" strings (no timezone). Timestamps are ISO UTC strings. */
export type ISODate = string;

export function isValidISODate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Display Indian style: DD/MM/YYYY. */
export function formatDateIN(s: ISODate): string {
  if (!isValidISODate(s)) return '';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function addDays(s: ISODate, days: number): ISODate {
  if (!isValidISODate(s)) throw new Error(`Invalid date: ${s}`);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** "18/11/2026 14:05" in the device's local time, from an ISO timestamp. */
export function formatDateTimeIN(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
