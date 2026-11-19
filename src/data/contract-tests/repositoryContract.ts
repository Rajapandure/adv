import { describe, it, expect, beforeEach } from 'vitest';
import type { Repository } from '../repositories/Repository';

/** The same behavioural suite runs against every adapter. If it passes on both, the app behaves identically on web and Android. */
export function repositoryContract(name: string, makeFactory: () => Promise<(profileId: string) => Repository>) {
  describe(`Repository contract: ${name}`, () => {
    let repoFor: (p: string) => Repository;
    let repo: Repository;
    beforeEach(async () => { repoFor = await makeFactory(); repo = repoFor('profile-a'); });

    const client = (over: Record<string, unknown> = {}) => repo.create('clients', { name: 'Asha Verma', phone: '9876543210', ...over });
    const aCase = (over: Record<string, unknown> = {}) => repo.create('cases', { internal_no: 'ADV-0001', title: 'Verma v. State', ...over });

    it('assigns id, timestamps, version and applies defaults', async () => {
      const c = await client();
      expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(c).toMatchObject({ version: 1, deleted_at: null, profile_id: 'profile-a', type: 'individual', archived: 0, alt_phone: null });
      expect(await repo.get('clients', c.id)).toEqual(c);
    });

    it('rejects missing, unknown, blank and non-integer values', async () => {
      await expect(repo.create('clients', { phone: '1' })).rejects.toMatchObject({ code: 'ValidationError' });
      await expect(repo.create('clients', { name: '  ', phone: '1' })).rejects.toMatchObject({ code: 'ValidationError' });
      await expect(client({ nope: 1 })).rejects.toMatchObject({ code: 'ValidationError' });
      await expect(client({ id: 'x' })).rejects.toMatchObject({ code: 'ValidationError' });
      const cl = await client();
      await expect(repo.create('fee_records', { client_id: cl.id, kind: 'professional', agreed_paise: 10.5 })).rejects.toMatchObject({ code: 'ValidationError' });
    });

    it('round-trips JSON columns', async () => {
      const a = await aCase({ connected_case_ids: ['x', 'y'] });
      expect((await repo.get('cases', a.id))!.connected_case_ids).toEqual(['x', 'y']);
      await repo.create('app_settings', { key: 'reminders', value: { hearingDaysBefore: [1, 3] } });
      const [s] = await repo.list('app_settings', { where: { key: 'reminders' } });
      expect(s.value).toEqual({ hearingDaysBefore: [1, 3] });
    });

    it('update bumps version and detects stale writes', async () => {
      const c = await client();
      const u = await repo.update('clients', c.id, { city: 'Sagar' }, 1);
      expect(u).toMatchObject({ version: 2, city: 'Sagar' });
      await expect(repo.update('clients', c.id, { city: 'Bhopal' }, 1)).rejects.toMatchObject({ code: 'ConflictError' });
      await expect(repo.update('clients', c.id, { version: 9 })).rejects.toMatchObject({ code: 'ValidationError' });
      await expect(repo.update('clients', 'missing', { city: 'x' })).rejects.toMatchObject({ code: 'NotFoundError' });
      expect((await repo.get('clients', c.id))!.city).toBe('Sagar');
    });

    it('enforces foreign keys, including soft-deleted parents', async () => {
      const cl = await client();
      await expect(repo.create('case_clients', { case_id: 'nope', client_id: cl.id })).rejects.toMatchObject({ code: 'ReferentialError' });
      const a = await aCase();
      await repo.create('case_clients', { case_id: a.id, client_id: cl.id });
      await expect(repo.update('case_clients', (await repo.list('case_clients'))[0].id, { client_id: 'nope' })).rejects.toMatchObject({ code: 'ReferentialError' });
    });

    it('supports many clients per case and many cases per client', async () => {
      const [c1, c2] = [await client(), await client({ name: 'Ravi Jain' })];
      const [k1, k2] = [await aCase(), await aCase({ internal_no: 'ADV-0002', title: 'Jain v. Jain' })];
      for (const [k, c] of [[k1, c1], [k1, c2], [k2, c1]] as const) await repo.create('case_clients', { case_id: k.id, client_id: c.id });
      expect(await repo.count('case_clients', { where: { case_id: k1.id } })).toBe(2);
      expect(await repo.count('case_clients', { where: { client_id: c1.id } })).toBe(2);
    });

    it('soft delete hides rows, restores them, and refuses while dependents exist', async () => {
      const cl = await client(); const a = await aCase();
      const link = await repo.create('case_clients', { case_id: a.id, client_id: cl.id });
      await expect(repo.softDelete('clients', cl.id)).rejects.toMatchObject({ code: 'ReferentialError' });
      await repo.softDelete('case_clients', link.id);
      await repo.softDelete('clients', cl.id);
      expect(await repo.get('clients', cl.id)).toBeNull();
      expect(await repo.list('clients')).toHaveLength(0);
      expect((await repo.get('clients', cl.id, { includeDeleted: true }))!.deleted_at).not.toBeNull();
      await repo.restore('clients', cl.id);
      expect((await repo.get('clients', cl.id))!.version).toBe(3);
      await expect(repo.create('case_clients', { case_id: a.id, client_id: cl.id })).resolves.toBeTruthy();
    });

    it('lists with filter, ordering, null filter and pagination', async () => {
      for (const [n, city] of [['Chitra', 'Sagar'], ['Anil', 'Bhopal'], ['Bela', null]] as const) await client({ name: n, city });
      expect((await repo.list('clients', { orderBy: { column: 'name' } })).map((r) => r.name)).toEqual(['Anil', 'Bela', 'Chitra']);
      expect((await repo.list('clients', { orderBy: { column: 'name', dir: 'desc' }, limit: 1, offset: 1 })).map((r) => r.name)).toEqual(['Bela']);
      expect((await repo.list('clients', { where: { city: 'Sagar' } })).map((r) => r.name)).toEqual(['Chitra']);
      expect((await repo.list('clients', { where: { city: null } })).map((r) => r.name)).toEqual(['Bela']);
      expect(await repo.count('clients')).toBe(3);
      await expect(repo.list('clients', { where: { bogus: 1 } })).rejects.toMatchObject({ code: 'ValidationError' });
    });

    it('rolls back every write in a failed transaction', async () => {
      await expect(repo.transaction(async (tx) => {
        const c = await tx.create('clients', { name: 'Temp', phone: '1' });
        await tx.create('cases', { internal_no: 'T-1', title: 'Temp case' });
        expect(await tx.count('clients')).toBe(1);
        await tx.create('case_clients', { case_id: 'nope', client_id: c.id });
      })).rejects.toMatchObject({ code: 'ReferentialError' });
      expect(await repo.count('clients')).toBe(0);
      expect(await repo.count('cases')).toBe(0);
    });

    it('commits a successful transaction', async () => {
      await repo.transaction(async (tx) => {
        const c = await tx.create('clients', { name: 'Kept', phone: '1' });
        const k = await tx.create('cases', { internal_no: 'K-1', title: 'Kept case' });
        await tx.create('case_clients', { case_id: k.id, client_id: c.id });
      });
      expect(await repo.count('case_clients')).toBe(1);
    });

    it('issues unique, gap-free sequence numbers even under concurrency', async () => {
      const got = await Promise.all(Array.from({ length: 15 }, () => repo.nextSequence('receipt', 'RCPT-')));
      expect(got.map((g) => g.value).sort((a, b) => a - b)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
      expect(got.find((g) => g.value === 7)!.formatted).toBe('RCPT-0007');
      expect((await repo.nextSequence('case', 'ADV-')).value).toBe(1);
    });

    it('isolates profiles completely', async () => {
      const mine = await client();
      const other = repoFor('profile-b');
      expect(await other.get('clients', mine.id)).toBeNull();
      expect(await other.count('clients')).toBe(0);
      await expect(other.update('clients', mine.id, { city: 'x' })).rejects.toMatchObject({ code: 'NotFoundError' });
      await expect(other.create('case_clients', { case_id: 'x', client_id: mine.id })).rejects.toMatchObject({ code: 'ReferentialError' });
      expect((await other.nextSequence('receipt')).value).toBe(1);
    });
  });
}
