import { z } from 'zod';
import type { Repository, Row } from '@/data/repositories/Repository';
import { ReferentialError } from '@/data/repositories/Repository';
import { audit } from './clients';

export const courtSchema = z.object({
  name: z.string().trim().min(2, 'err.name'), court_type: z.string().trim(), district: z.string().trim(), state: z.string().trim(),
  address: z.string().trim(), bench: z.string().trim(), courtroom: z.string().trim(), judge: z.string().trim(),
});
export type CourtInput = z.infer<typeof courtSchema>;
const nz = (s: string) => (s === '' ? null : s);
const courtRow = (i: CourtInput) => Object.fromEntries(Object.entries(i).map(([k, v]) => [k, nz(v as string)]));
export const courtToInput = (r: Row | null): CourtInput => ({
  name: String(r?.name ?? ''), court_type: String(r?.court_type ?? ''), district: String(r?.district ?? ''), state: String(r?.state ?? ''),
  address: String(r?.address ?? ''), bench: String(r?.bench ?? ''), courtroom: String(r?.courtroom ?? ''), judge: String(r?.judge ?? ''),
});

export class CourtService {
  constructor(private readonly repo: Repository) {}
  async list(): Promise<Row[]> {
    const rows = await this.repo.list('courts');
    return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  async create(input: CourtInput): Promise<Row> {
    const data = courtRow(courtSchema.parse(input));
    return this.repo.transaction(async (tx) => { const r = await tx.create('courts', data); await audit(tx, 'court.create', 'courts', r.id); return r; });
  }
  async update(id: string, input: CourtInput, v?: number): Promise<Row> {
    const data = courtRow(courtSchema.parse(input));
    return this.repo.transaction(async (tx) => { const r = await tx.update('courts', id, data, v); await audit(tx, 'court.update', 'courts', id); return r; });
  }
  /** Soft delete; refused while any case still uses the court. */
  remove(id: string): Promise<void> {
    return this.repo.transaction(async (tx) => { await tx.softDelete('courts', id); await audit(tx, 'court.remove', 'courts', id); });
  }
}
export { ReferentialError };

const DEFAULT_CATEGORIES = ['Civil', 'Criminal', 'Family', 'Property', 'Consumer', 'Revenue', 'Constitutional', 'Other'];

/** Categories are user data: seeded once with a starting set, then fully editable (add, rename, remove). */
export class CategoryService {
  constructor(private readonly repo: Repository) {}
  async list(): Promise<Row[]> {
    await this.seedOnce();
    return this.repo.list('case_categories', { orderBy: { column: 'sort_order' } });
  }
  private seedOnce(): Promise<void> {
    return this.repo.transaction(async (tx) => {
      if ((await tx.list('app_settings', { where: { key: 'categories_seeded' } })).length) return;
      for (const [i, name] of DEFAULT_CATEGORIES.entries()) await tx.create('case_categories', { name, sort_order: i });
      await tx.create('app_settings', { key: 'categories_seeded', value: true });
    });
  }
  async add(name: string): Promise<Row> {
    const n = (await this.repo.count('case_categories')) as number;
    return this.repo.create('case_categories', { name: name.trim(), sort_order: n });
  }
  rename(id: string, name: string) { return this.repo.update('case_categories', id, { name: name.trim() }); }
  remove(id: string) { return this.repo.softDelete('case_categories', id); }
}
