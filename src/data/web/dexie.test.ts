// @vitest-environment node
import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { openAdvocateDb, DexieRepository, dexieStores } from './DexieRepository';
import { repositoryContract } from '../contract-tests/repositoryContract';
import { SCHEMA_VERSION, TABLE_NAMES } from '../schema';

let n = 0;
repositoryContract('Dexie / IndexedDB (web)', async () => {
  const db = openAdvocateDb(`test-${n++}`);
  await db.open();
  return (profileId) => new DexieRepository(db, profileId);
});

describe('Dexie schema', () => {
  it('has a store for every table and reopens at the same version', async () => {
    expect(Object.keys(dexieStores())).toEqual(TABLE_NAMES);
    const a = openAdvocateDb('reopen'); await a.open();
    expect(a.verno).toBe(SCHEMA_VERSION); a.close();
    const b = openAdvocateDb('reopen'); await b.open();
    expect(b.tables.map((t) => t.name).sort()).toEqual([...TABLE_NAMES].sort());
    b.close();
  });
});
