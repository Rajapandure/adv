import { describe, it, expect } from 'vitest';
import { formatINR, parseRupees, splitInstalments, sumPaise, assertPaise } from './money';
import { addDays, formatDateIN, isValidISODate, todayISO } from './dates';
import { uuidv7 } from './id';

describe('money', () => {
  it('formats with Indian grouping', () => {
    expect(formatINR(12500050)).toBe('₹1,25,000.50');
    expect(formatINR(1000000000)).toBe('₹1,00,00,000');
    expect(formatINR(-50000)).toBe('-₹500');
    expect(formatINR(0, { showPaise: true })).toBe('₹0.00');
  });
  it('parses rupee input exactly', () => {
    expect(parseRupees('1,25,000.5')).toBe(12500050);
    expect(parseRupees('₹ 500')).toBe(50000);
    expect(parseRupees('0.1')).toBe(10);
    expect(parseRupees('12.345')).toBeNull();
    expect(parseRupees('abc')).toBeNull();
  });
  it('avoids floating point drift', () => {
    expect(sumPaise([10, 20])).toBe(30);
    expect(parseRupees('0.10')! + parseRupees('0.20')!).toBe(30);
  });
  it('rejects non-integers', () => {
    expect(() => assertPaise(10.5)).toThrow();
  });
  it('splits instalments exactly', () => {
    const parts = splitInstalments(100000, 3);
    expect(parts).toEqual([33334, 33333, 33333]);
    expect(sumPaise(parts)).toBe(100000);
  });
});

describe('dates', () => {
  it('validates real calendar dates', () => {
    expect(isValidISODate('2024-02-29')).toBe(true);
    expect(isValidISODate('2023-02-29')).toBe(false);
    expect(isValidISODate('2023-13-01')).toBe(false);
  });
  it('formats DD/MM/YYYY', () => {
    expect(formatDateIN('2026-11-18')).toBe('18/11/2026');
    expect(formatDateIN('bad')).toBe('');
  });
  it('adds days across month ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('uses local calendar for today', () => {
    expect(todayISO(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
  });
});

describe('uuidv7', () => {
  it('is a valid v7 uuid and time ordered', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});
