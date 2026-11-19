// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openAdvocateDb, DexieRepository } from '@/data/web/DexieRepository';
import { NodeSqliteDriver } from '@/data/android/testing/NodeSqliteDriver';
import { migrateSqlite } from '@/data/android/migrations';
import { SqliteRepository } from '@/data/android/SqliteRepository';
import type { Repository } from '@/data/repositories/Repository';
import { createServices } from '.';
import { caseSchema, caseToInput } from './cases';

let n = 0;
const adapters: [string, () => Promise<Repository>][] = [
  ['Dexie', async () => { const db = openAdvocateDb(`cs-${n++}`); await db.open(); return new DexieRepository(db, 'p'); }],
  ['SQLite', async () => { const d = new NodeSqliteDriver(); await migrateSqlite(d); return new SqliteRepository(d, 'p'); }],
];
const client = { type: 'individual' as const, name: 'Asha Verma', phone: '9876543210', alt_phone: '', email: '', address: '', city: '', state: '', pin: '', notes: '' };
const base = { ...caseToInput(null), title: 'Verma v. State of M.P.' };

describe('case validation', () => {
  it('returns i18n keys', () => {
    const r = caseSchema.safeParse({ ...base, title: 'ab', case_year: '19', cnr: 'x', filing_date: '2026-02-30' });
    expect(r.error!.issues.map((i) => i.message).sort()).toEqual(['err.cnr', 'err.date', 'err.title', 'err.year']);
  });
});

describe.each(adapters)('case services on %s', (_n, make) => {
  it('seeds editable categories exactly once', async () => {
    const s = createServices(await make());
    const first = await s.categories.list();
    expect(first.map((c) => c.name)).toContain('Criminal');
    for (const c of first) await s.categories.remove(c.id);
    expect(await s.categories.list()).toHaveLength(0); // not re-seeded after the user removes them
    await s.categories.add('Arbitration');
    expect((await s.categories.list()).map((c) => c.name)).toEqual(['Arbitration']);
  });

  it('creates a case with number, linked client, filing event and audit entry', async () => {
    const s = createServices(await make());
    const cl = await s.clients.create(client);
    const court = await s.courts.create({ name: 'District Court Sagar', court_type: 'District', district: 'Sagar', state: 'Madhya Pradesh', address: '', bench: '', courtroom: '3', judge: '' });
    const c = await s.cases.create({ ...base, client_id: cl.id, court_id: court.id, filing_date: '2026-03-10', cnr: 'mpsg010012342026' });
    expect(c).toMatchObject({ internal_no: 'ADV-0001', cnr: 'MPSG010012342026', status: 'active' });
    const d = (await s.cases.detail(c.id))!;
    expect(d.clients.map((x) => x.client.name)).toEqual(['Asha Verma']);
    expect(d.court!.name).toBe('District Court Sagar');
    expect(d.events.map((e) => [e.kind, e.event_date])).toEqual([['filing', '2026-03-10']]);
    expect((await s.clients.detail(cl.id))!.cases.map((x) => x.id)).toEqual([c.id]);
  });

  it('supports many clients and many parties per case, and rejects duplicates', async () => {
    const s = createServices(await make());
    const [a, b] = [await s.clients.create(client), await s.clients.create({ ...client, name: 'Ravi Jain', phone: '9123456780' })];
    const c = await s.cases.create({ ...base, client_id: a.id });
    await s.cases.addClient(c.id, b.id, 'respondent');
    await expect(s.cases.addClient(c.id, b.id, '')).rejects.toMatchObject({ code: 'ValidationError' });
    await s.cases.addParty(c.id, { name: 'State of M.P.', side: 'respondent', advocate_name: 'Govt. Advocate' });
    await s.cases.addParty(c.id, { name: 'Co-accused', side: 'other' });
    const d = (await s.cases.detail(c.id))!;
    expect(d.clients).toHaveLength(2);
    expect(d.parties.map((p) => p.name).sort()).toEqual(['Co-accused', 'State of M.P.']);
    await s.cases.removeClient(d.clients[1].link.id, c.id);
    expect((await s.cases.detail(c.id))!.clients).toHaveLength(1);
    expect((await s.cases.list({ q: 'state of' })).map((x) => x.id)).toEqual([c.id]); // finds by party name
  });

  it('records status changes in the chronology and filters by status', async () => {
    const s = createServices(await make());
    const c = await s.cases.create(base);
    await s.cases.create({ ...base, title: 'Second matter' });
    await s.cases.setStatus(c.id, 'closed');
    expect((await s.cases.list({ status: 'closed' })).map((x) => x.id)).toEqual([c.id]);
    expect((await s.cases.detail(c.id))!.events.map((e) => e.text)).toContain('Status: closed');
    expect((await s.dashboard.stats('2026-11-19'))).toMatchObject({ activeCases: 1, closedCases: 1 });
  });

  it('keeps connected cases symmetric and undoes both sides together', async () => {
    const s = createServices(await make());
    const [a, b] = [await s.cases.create(base), await s.cases.create({ ...base, title: 'Appeal' })];
    await s.cases.connect(a.id, b.id);
    expect((await s.cases.detail(a.id))!.connected.map((x) => x.id)).toEqual([b.id]);
    expect((await s.cases.detail(b.id))!.connected.map((x) => x.id)).toEqual([a.id]);
    await expect(s.cases.connect(a.id, a.id)).rejects.toMatchObject({ code: 'ValidationError' });
    await s.cases.disconnect(b.id, a.id);
    expect((await s.cases.detail(a.id))!.connected).toHaveLength(0);
  });

  it('refuses to remove a court or category that cases still use', async () => {
    const s = createServices(await make());
    const court = await s.courts.create({ name: 'High Court', court_type: '', district: '', state: '', address: '', bench: '', courtroom: '', judge: '' });
    const [cat] = await s.categories.list();
    const c = await s.cases.create({ ...base, court_id: court.id, category_id: cat.id });
    await expect(s.courts.remove(court.id)).rejects.toMatchObject({ code: 'ReferentialError' });
    await expect(s.categories.remove(cat.id)).rejects.toMatchObject({ code: 'ReferentialError' });
    await s.cases.update(c.id, { ...base, court_id: '', category_id: '' });
    await s.courts.remove(court.id);
    expect(await s.courts.list()).toHaveLength(0);
  });

  it('searches cases by CNR and registration number, and routes hits to the case page', async () => {
    const s = createServices(await make());
    const c = await s.cases.create({ ...base, cnr: 'MPSG010012342026', reg_no: 'CRA 123/2026' });
    await s.cases.addParty(c.id, { name: 'Unique Party Name', side: 'other' });
    expect((await s.search.search('mpsg0100'))[0].route).toBe(`/cases/${c.id}`);
    expect((await s.search.search('cra 123'))[0].id).toBe(c.id);
    expect((await s.search.search('unique party'))[0]).toMatchObject({ type: 'party', route: `/cases/${c.id}` });
  });
});
