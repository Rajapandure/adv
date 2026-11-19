// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openAdvocateDb, DexieRepository } from '@/data/web/DexieRepository';
import { NodeSqliteDriver } from '@/data/android/testing/NodeSqliteDriver';
import { migrateSqlite } from '@/data/android/migrations';
import { SqliteRepository } from '@/data/android/SqliteRepository';
import type { Repository } from '@/data/repositories/Repository';
import { createServices } from '.';
import { clientSchema, normalizePhone } from './clients';

let n = 0;
const adapters: [string, () => Promise<Repository>][] = [
  ['Dexie', async () => { const db = openAdvocateDb(`svc-${n++}`); await db.open(); return new DexieRepository(db, 'p'); }],
  ['SQLite', async () => { const d = new NodeSqliteDriver(); await migrateSqlite(d); return new SqliteRepository(d, 'p'); }],
];
const valid = { type: 'individual' as const, name: 'Asha Verma', phone: '+91 98765-43210', alt_phone: '', email: '', address: '', city: 'Sagar', state: 'Madhya Pradesh', pin: '470001', notes: '' };

describe('validation', () => {
  it('normalises Indian phone formats', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });
  it('returns i18n keys as messages', () => {
    const r = clientSchema.safeParse({ ...valid, name: 'A', phone: '12345', email: 'x', pin: '12' });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.message).sort()).toEqual(['err.email', 'err.name', 'err.phone', 'err.pin']);
  });
});

describe.each(adapters)('services on %s', (_name, make) => {
  it('creates clients with sequential numbers, normalised phone and an audit entry', async () => {
    const s = createServices(await make());
    const a = await s.clients.create(valid);
    const b = await s.clients.create({ ...valid, name: 'Ravi Jain', phone: '9123456780' });
    expect([a.client_no, b.client_no]).toEqual(['CL-0001', 'CL-0002']);
    expect(a.phone).toBe('9876543210');
    const logs = await s.repo.list('audit_logs');
    expect(logs.map((l) => l.action)).toEqual(['client.create', 'client.create']);
    expect(JSON.stringify(logs)).not.toContain('Asha'); // no confidential content in audit log
  });

  it('rolls back the client when anything in the create fails', async () => {
    const repo = await make();
    const s = createServices(repo);
    await expect(s.clients.create({ ...valid, phone: 'bad' })).rejects.toThrow();
    expect(await repo.count('clients')).toBe(0);
    expect(await repo.count('number_sequences')).toBe(0);
  });

  it('detects duplicate phones, ignoring the client being edited', async () => {
    const s = createServices(await make());
    const a = await s.clients.create(valid);
    expect(await s.clients.findDuplicates('98765 43210')).toHaveLength(1);
    expect(await s.clients.findDuplicates('9876543210', a.id)).toHaveLength(0);
  });

  it('updates with version checking and archives/restores without deleting', async () => {
    const s = createServices(await make());
    const a = await s.clients.create(valid);
    const u = await s.clients.update(a.id, { ...valid, city: 'Bhopal' }, a.version);
    expect(u.city).toBe('Bhopal');
    await expect(s.clients.update(a.id, valid, a.version)).rejects.toMatchObject({ code: 'ConflictError' });
    await s.clients.setArchived(a.id, true);
    expect(await s.clients.list()).toHaveLength(0);
    expect(await s.clients.list({ includeArchived: true })).toHaveLength(1);
    await s.clients.setArchived(a.id, false);
    expect(await s.clients.list()).toHaveLength(1);
    expect((await s.clients.detail(a.id))!.history.map((h) => h.action).sort()).toEqual(['client.archive', 'client.create', 'client.restore', 'client.update']);
  });

  it('filters the list by name, client number and phone digits', async () => {
    const s = createServices(await make());
    await s.clients.create(valid);
    await s.clients.create({ ...valid, name: 'Ravi Jain', phone: '9123456780', city: 'Bhopal' });
    expect((await s.clients.list({ q: 'ravi' })).map((r) => r.name)).toEqual(['Ravi Jain']);
    expect((await s.clients.list({ q: 'cl-0001' })).map((r) => r.name)).toEqual(['Asha Verma']);
    expect((await s.clients.list({ q: '91234' })).map((r) => r.name)).toEqual(['Ravi Jain']);
    expect((await s.clients.list({ q: 'zzz' }))).toHaveLength(0);
  });

  it('computes the dashboard from real records', async () => {
    const repo = await make();
    const s = createServices(repo);
    const c = await s.clients.create(valid);
    const k = await repo.create('cases', { internal_no: 'ADV-1', title: 'T', status: 'active' });
    await repo.create('cases', { internal_no: 'ADV-2', title: 'U', status: 'closed' });
    for (const d of ['2026-11-18', '2026-11-20', '2026-12-30']) await repo.create('hearings', { case_id: k.id, hearing_date: d });
    await repo.create('tasks', { title: 'Call', status: 'pending' });
    const fee = await repo.create('fee_records', { client_id: c.id, case_id: k.id, kind: 'professional', agreed_paise: 5000000 });
    await repo.create('payments', { fee_record_id: fee.id, amount_paise: 1500050, paid_on: '2026-11-05' });
    await repo.create('payments', { fee_record_id: fee.id, amount_paise: 500000, paid_on: '2026-10-05' });
    const st = await s.dashboard.stats('2026-11-18');
    expect(st).toMatchObject({ clients: 1, activeCases: 1, closedCases: 1, todaysHearings: 1, upcomingHearings: 1, pendingTasks: 1,
      outstandingPaise: 5000000 - 2000050, monthlyCollectionPaise: 1500050 });
    expect(st.recent[0].action).toBe('client.create');
    const d = (await s.clients.detail(c.id))!;
    expect(d.totals).toEqual({ agreed: 5000000, paid: 2000050, outstanding: 2999950 });
    expect(d.payments).toHaveLength(2);
  });

  it('searches clients, cases, parties and more offline, including by phone digits', async () => {
    const repo = await make();
    const s = createServices(repo);
    await s.clients.create(valid);
    const k = await repo.create('cases', { internal_no: 'ADV-0007', title: 'Verma v. State', cnr: 'MPSG010012342020', petitioner: 'Asha Verma' });
    await repo.create('case_parties', { case_id: k.id, name: 'State of M.P.', side: 'respondent' });
    await repo.create('courts', { name: 'District Court Sagar' });
    expect((await s.search.search('verma')).map((h) => h.type).sort()).toEqual(['case', 'client']);
    expect((await s.search.search('mpsg0100'))[0]).toMatchObject({ type: 'case', id: k.id });
    expect((await s.search.search('98765'))[0].type).toBe('client');
    expect((await s.search.search('state of'))[0].type).toBe('party');
    expect((await s.search.search('sagar')).some((h) => h.type === 'court')).toBe(true);
    expect(await s.search.search('a')).toEqual([]);
  });
});
