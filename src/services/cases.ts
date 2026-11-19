import { z } from 'zod';
import type { Repository, Row } from '@/data/repositories/Repository';
import { RepositoryError, ValidationError } from '@/data/repositories/Repository';
import { isValidISODate, todayISO } from '@/domain/dates';
import { audit } from './clients';

export const CASE_STATUSES = ['active', 'on_hold', 'closed'] as const;
export const PARTY_SIDES = ['petitioner', 'respondent', 'other'] as const;
const opt = (test: (v: string) => boolean, msg: string) => z.string().trim().refine((v) => v === '' || test(v), msg);

export const caseSchema = z.object({
  title: z.string().trim().min(3, 'err.title'),
  reg_no: z.string().trim(),
  case_year: opt((v) => /^\d{4}$/.test(v) && +v >= 1900 && +v <= 2100, 'err.year'),
  cnr: opt((v) => /^[A-Za-z]{4}\d{12}$/.test(v), 'err.cnr'),
  category_id: z.string(), case_type: z.string().trim(), court_id: z.string(),
  district: z.string().trim(), judge: z.string().trim(),
  filing_date: opt(isValidISODate, 'err.date'),
  petitioner: z.string().trim(), respondent: z.string().trim(), stage: z.string().trim(),
  status: z.enum(CASE_STATUSES), description: z.string().trim(),
  /** Only used when creating: links this client to the new case. */
  client_id: z.string(),
});
export type CaseInput = z.infer<typeof caseSchema>;

const nz = (s: string) => (s === '' ? null : s);
export function caseToRow(i: CaseInput) {
  return {
    title: i.title, reg_no: nz(i.reg_no), case_year: i.case_year ? Number(i.case_year) : null, cnr: i.cnr ? i.cnr.toUpperCase() : null,
    category_id: nz(i.category_id), case_type: nz(i.case_type), court_id: nz(i.court_id), district: nz(i.district), judge: nz(i.judge),
    filing_date: nz(i.filing_date), petitioner: nz(i.petitioner), respondent: nz(i.respondent), stage: nz(i.stage),
    status: i.status, description: nz(i.description),
  };
}
const s = (v: unknown) => (v == null ? '' : String(v));
export const caseToInput = (r: Row | null): CaseInput => ({
  title: s(r?.title), reg_no: s(r?.reg_no), case_year: s(r?.case_year), cnr: s(r?.cnr), category_id: s(r?.category_id), case_type: s(r?.case_type),
  court_id: s(r?.court_id), district: s(r?.district), judge: s(r?.judge), filing_date: s(r?.filing_date), petitioner: s(r?.petitioner),
  respondent: s(r?.respondent), stage: s(r?.stage), status: (r?.status as CaseInput['status']) ?? 'active', description: s(r?.description), client_id: '',
});

export interface CaseDetail {
  case: Row; category: Row | null; court: Row | null;
  clients: { link: Row; client: Row }[]; parties: Row[]; connected: Row[]; events: Row[];
}

async function event(tx: Repository, caseId: string, kind: string, text: string, date = todayISO()) {
  await tx.create('case_events', { case_id: caseId, event_date: date, kind, text });
}

export class CaseService {
  constructor(private readonly repo: Repository) {}

  async create(input: CaseInput): Promise<Row> {
    const parsed = caseSchema.parse(input);
    return this.repo.transaction(async (tx) => {
      const no = await tx.nextSequence('case', 'ADV-');
      const row = await tx.create('cases', { ...caseToRow(parsed), internal_no: no.formatted });
      if (parsed.client_id) await tx.create('case_clients', { case_id: row.id, client_id: parsed.client_id, role: 'petitioner' });
      if (parsed.filing_date) await event(tx, row.id, 'filing', 'Case filed', parsed.filing_date);
      await audit(tx, 'case.create', 'cases', row.id);
      return row;
    });
  }

  async update(id: string, input: CaseInput, expectedVersion?: number): Promise<Row> {
    const parsed = caseSchema.parse(input);
    return this.repo.transaction(async (tx) => {
      const before = await tx.get('cases', id);
      const row = await tx.update('cases', id, caseToRow(parsed), expectedVersion);
      if (before && before.status !== row.status) await event(tx, id, 'status', `Status: ${String(row.status)}`);
      await audit(tx, 'case.update', 'cases', id);
      return row;
    });
  }

  setStatus(id: string, status: (typeof CASE_STATUSES)[number]): Promise<Row> {
    return this.repo.transaction(async (tx) => {
      const row = await tx.update('cases', id, { status });
      await event(tx, id, 'status', `Status: ${status}`);
      await audit(tx, status === 'closed' ? 'case.close' : 'case.reopen', 'cases', id);
      return row;
    });
  }

  async list(o: { q?: string; status?: string; categoryId?: string; courtId?: string } = {}): Promise<Row[]> {
    const where: Record<string, string> = {};
    if (o.status) where.status = o.status;
    if (o.categoryId) where.category_id = o.categoryId;
    if (o.courtId) where.court_id = o.courtId;
    let rows = await this.repo.list('cases', { where, orderBy: { column: 'id', dir: 'desc' } });
    const q = (o.q ?? '').trim().toLowerCase();
    if (q) {
      const partyCaseIds = new Set((await this.repo.list('case_parties')).filter((p) => s(p.name).toLowerCase().includes(q)).map((p) => p.case_id));
      rows = rows.filter((r) => partyCaseIds.has(r.id) || ['title', 'internal_no', 'reg_no', 'cnr', 'petitioner', 'respondent'].some((f) => s(r[f]).toLowerCase().includes(q)));
    }
    return rows;
  }

  async detail(id: string): Promise<CaseDetail | null> {
    const c = await this.repo.get('cases', id);
    if (!c) return null;
    const [category, court, links, parties, events] = await Promise.all([
      c.category_id ? this.repo.get('case_categories', c.category_id as string) : null,
      c.court_id ? this.repo.get('courts', c.court_id as string) : null,
      this.repo.list('case_clients', { where: { case_id: id } }),
      this.repo.list('case_parties', { where: { case_id: id } }),
      this.repo.list('case_events', { where: { case_id: id }, orderBy: { column: 'event_date', dir: 'desc' } }),
    ]);
    const clients = (await Promise.all(links.map(async (link) => ({ link, client: await this.repo.get('clients', link.client_id as string) }))))
      .filter((x): x is { link: Row; client: Row } => x.client !== null);
    const ids = (c.connected_case_ids as string[] | null) ?? [];
    const connected = (await Promise.all(ids.map((cid) => this.repo.get('cases', cid)))).filter((x): x is Row => x !== null);
    return { case: c, category, court, clients, parties, connected, events };
  }

  addClient(caseId: string, clientId: string, role: string): Promise<Row> {
    return this.repo.transaction(async (tx) => {
      const existing = await tx.list('case_clients', { where: { case_id: caseId, client_id: clientId } });
      if (existing.length) throw new ValidationError('This client is already linked to the case');
      const link = await tx.create('case_clients', { case_id: caseId, client_id: clientId, role: role || null });
      await audit(tx, 'case.addClient', 'cases', caseId);
      return link;
    });
  }
  removeClient(linkId: string, caseId: string): Promise<void> {
    return this.repo.transaction(async (tx) => { await tx.softDelete('case_clients', linkId); await audit(tx, 'case.removeClient', 'cases', caseId); });
  }

  addParty(caseId: string, p: { name: string; side: string; advocate_name?: string }): Promise<Row> {
    if (p.name.trim().length < 2) return Promise.reject(new ValidationError('err.name'));
    return this.repo.transaction(async (tx) => {
      const row = await tx.create('case_parties', { case_id: caseId, name: p.name.trim(), side: p.side, advocate_name: p.advocate_name?.trim() || null });
      await audit(tx, 'case.addParty', 'cases', caseId);
      return row;
    });
  }
  removeParty(partyId: string, caseId: string): Promise<void> {
    return this.repo.transaction(async (tx) => { await tx.softDelete('case_parties', partyId); await audit(tx, 'case.removeParty', 'cases', caseId); });
  }

  /** Connections are symmetric: linking A to B also links B to A, atomically. */
  connect(a: string, b: string): Promise<void> {
    if (a === b) return Promise.reject(new ValidationError('A case cannot be connected to itself'));
    return this.repo.transaction(async (tx) => {
      for (const [x, y] of [[a, b], [b, a]]) {
        const row = await tx.get('cases', x);
        if (!row) throw new RepositoryError('NotFoundError', `cases ${x} not found`);
        const ids = new Set((row.connected_case_ids as string[] | null) ?? []);
        ids.add(y);
        await tx.update('cases', x, { connected_case_ids: [...ids] });
      }
      await audit(tx, 'case.connect', 'cases', a);
    });
  }
  disconnect(a: string, b: string): Promise<void> {
    return this.repo.transaction(async (tx) => {
      for (const [x, y] of [[a, b], [b, a]]) {
        const row = await tx.get('cases', x);
        if (!row) continue;
        const ids = ((row.connected_case_ids as string[] | null) ?? []).filter((i) => i !== y);
        await tx.update('cases', x, { connected_case_ids: ids.length ? ids : null });
      }
      await audit(tx, 'case.disconnect', 'cases', a);
    });
  }
}
