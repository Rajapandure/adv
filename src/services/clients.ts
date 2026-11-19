import { z } from 'zod';
import type { Repository, Row } from '@/data/repositories/Repository';
import { sumPaise } from '@/domain/money';

export function normalizePhone(s: string): string {
  return s.replace(/[\s-]/g, '').replace(/^\+91/, '').replace(/^0(?=\d{10}$)/, '');
}
const mobile = /^[6-9]\d{9}$/;
const optional = (test: (v: string) => boolean, msg: string) => z.string().trim().refine((v) => v === '' || test(v), msg);

/** Validation messages are i18n keys (see messages.ts); the form translates them. */
export const clientSchema = z.object({
  type: z.enum(['individual', 'organization']),
  name: z.string().trim().min(2, 'err.name'),
  phone: z.string().trim().refine((v) => mobile.test(normalizePhone(v)), 'err.phone'),
  alt_phone: optional((v) => mobile.test(normalizePhone(v)), 'err.phone'),
  email: optional((v) => z.string().email().safeParse(v).success, 'err.email'),
  address: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim(),
  pin: optional((v) => /^[1-9]\d{5}$/.test(v), 'err.pin'),
  notes: z.string().trim(),
});
export type ClientInput = z.infer<typeof clientSchema>;

const nz = (s: string) => (s === '' ? null : s);
export const toRow = (i: ClientInput) => ({
  type: i.type, name: i.name, phone: normalizePhone(i.phone), alt_phone: i.alt_phone ? normalizePhone(i.alt_phone) : null,
  email: nz(i.email), address: nz(i.address), city: nz(i.city), state: nz(i.state), pin: nz(i.pin), notes: nz(i.notes),
});
export const toInput = (r: Row | null): ClientInput => ({
  type: (r?.type as ClientInput['type']) ?? 'individual', name: (r?.name as string) ?? '', phone: (r?.phone as string) ?? '',
  alt_phone: (r?.alt_phone as string) ?? '', email: (r?.email as string) ?? '', address: (r?.address as string) ?? '',
  city: (r?.city as string) ?? '', state: (r?.state as string) ?? '', pin: (r?.pin as string) ?? '', notes: (r?.notes as string) ?? '',
});

/** Audit entries record WHAT happened, never the confidential content. */
export async function audit(tx: Repository, action: string, entity: string, entityId: string) {
  await tx.create('audit_logs', { action, entity, entity_id: entityId, at: new Date().toISOString() });
}

export interface ClientDetail {
  client: Row; cases: Row[];
  payments: { row: Row; feeKind: string }[];
  totals: { agreed: number; paid: number; outstanding: number };
  history: Row[];
}

export class ClientService {
  constructor(private readonly repo: Repository) {}

  async create(input: ClientInput): Promise<Row> {
    const data = toRow(clientSchema.parse(input));
    return this.repo.transaction(async (tx) => {
      const no = await tx.nextSequence('client', 'CL-');
      const row = await tx.create('clients', { ...data, client_no: no.formatted });
      await audit(tx, 'client.create', 'clients', row.id);
      return row;
    });
  }

  async update(id: string, input: ClientInput, expectedVersion?: number): Promise<Row> {
    const data = toRow(clientSchema.parse(input));
    return this.repo.transaction(async (tx) => {
      const row = await tx.update('clients', id, data, expectedVersion);
      await audit(tx, 'client.update', 'clients', id);
      return row;
    });
  }

  setArchived(id: string, archived: boolean): Promise<Row> {
    return this.repo.transaction(async (tx) => {
      const row = await tx.update('clients', id, { archived: archived ? 1 : 0 });
      await audit(tx, archived ? 'client.archive' : 'client.restore', 'clients', id);
      return row;
    });
  }

  get(id: string) { return this.repo.get('clients', id); }

  async findDuplicates(phone: string, excludeId?: string): Promise<Row[]> {
    const rows = await this.repo.list('clients', { where: { phone: normalizePhone(phone) } });
    return rows.filter((r) => r.id !== excludeId);
  }

  async list(o: { q?: string; includeArchived?: boolean } = {}): Promise<Row[]> {
    const rows = await this.repo.list('clients', { where: o.includeArchived ? undefined : { archived: 0 } });
    rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const q = (o.q ?? '').trim().toLowerCase();
    if (!q) return rows;
    const digits = q.replace(/\D/g, '');
    const phoneSearch = digits.length >= 3 && /^[\d+\s-]+$/.test(q);
    return rows.filter((r) => phoneSearch
      ? [r.phone, r.alt_phone].some((p) => typeof p === 'string' && p.includes(digits))
      : [r.name, r.client_no, r.email, r.city].some((f) => typeof f === 'string' && f.toLowerCase().includes(q)));
  }

  async detail(id: string): Promise<ClientDetail | null> {
    const client = await this.repo.get('clients', id, { includeDeleted: true });
    if (!client) return null;
    const links = await this.repo.list('case_clients', { where: { client_id: id } });
    const cases = (await Promise.all(links.map((l) => this.repo.get('cases', l.case_id as string)))).filter((c): c is Row => c !== null);
    const fees = await this.repo.list('fee_records', { where: { client_id: id } });
    const payments = (await Promise.all(fees.map(async (f) =>
      (await this.repo.list('payments', { where: { fee_record_id: f.id }, orderBy: { column: 'paid_on', dir: 'desc' } })).map((row) => ({ row, feeKind: f.kind as string })))))
      .flat();
    const agreed = sumPaise(fees.map((f) => f.agreed_paise as number));
    const paid = sumPaise(payments.map((p) => p.row.amount_paise as number));
    const history = (await this.repo.list('audit_logs', { where: { entity: 'clients' }, orderBy: { column: 'at', dir: 'desc' } }))
      .filter((a) => a.entity_id === id);
    return { client, cases, payments, totals: { agreed, paid, outstanding: Math.max(0, agreed - paid) }, history };
  }
}
