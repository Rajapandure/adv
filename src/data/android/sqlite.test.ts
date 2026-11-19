// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { NodeSqliteDriver } from './testing/NodeSqliteDriver';
import { migrateSqlite, MIGRATIONS, type SqlMigration } from './migrations';
import { SqliteRepository, SqlLock } from './SqliteRepository';
import { repositoryContract } from '../contract-tests/repositoryContract';
import { SCHEMA_VERSION, TABLE_NAMES } from '../schema';
import { dexieStores } from '../web/DexieRepository';

repositoryContract('SQLite (Android)', async () => {
  const d = new NodeSqliteDriver();
  await migrateSqlite(d);
  const lock = new SqlLock();
  return (profileId) => new SqliteRepository(d, profileId, lock);
});

const tables = async (d: NodeSqliteDriver) =>
  (await d.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations'")).map((r) => r.name as string).sort();

describe('SQLite migrations', () => {
  it('creates every table, records the version and is idempotent', async () => {
    const d = new NodeSqliteDriver();
    expect(await migrateSqlite(d)).toBe(SCHEMA_VERSION);
    expect(await migrateSqlite(d)).toBe(SCHEMA_VERSION);
    expect(await tables(d)).toEqual([...TABLE_NAMES].sort());
    expect(await d.all('SELECT version FROM schema_migrations')).toHaveLength(1);
  });
  it('has the same tables as the web schema', async () => {
    const d = new NodeSqliteDriver(); await migrateSqlite(d);
    expect(await tables(d)).toEqual(Object.keys(dexieStores()).sort());
  });
  it('upgrades an existing database and keeps its data', async () => {
    const d = new NodeSqliteDriver(); await migrateSqlite(d);
    const repo = new SqliteRepository(d, 'p');
    await repo.create('clients', { name: 'Existing', phone: '1' });
    const v2: SqlMigration = { version: 2, description: 'add clients.gstin', statements: ['ALTER TABLE clients ADD COLUMN gstin TEXT'] };
    expect(await migrateSqlite(d, [...MIGRATIONS, v2])).toBe(2);
    expect((await d.all('SELECT name, gstin FROM clients'))[0]).toMatchObject({ name: 'Existing', gstin: null });
  });
  it('rolls a failed migration back completely', async () => {
    const d = new NodeSqliteDriver(); await migrateSqlite(d);
    const bad: SqlMigration = { version: 2, description: 'broken', statements: ['CREATE TABLE half_done (x TEXT)', 'THIS IS NOT SQL'] };
    await expect(migrateSqlite(d, [...MIGRATIONS, bad])).rejects.toThrow();
    expect(await tables(d)).not.toContain('half_done');
    expect(Number((await d.all('SELECT MAX(version) AS v FROM schema_migrations'))[0].v)).toBe(1);
  });
  it('refuses a database newer than the app without touching it', async () => {
    const d = new NodeSqliteDriver(); await migrateSqlite(d);
    await d.run('INSERT INTO schema_migrations VALUES (99, ?, ?)', ['future', 'now']);
    await expect(migrateSqlite(d)).rejects.toMatchObject({ code: 'SchemaTooNewError' });
  });
  it('enforces foreign keys in the database itself', async () => {
    const d = new NodeSqliteDriver(); await migrateSqlite(d);
    await expect(d.run("INSERT INTO case_clients (id, profile_id, created_at, updated_at, version, case_id, client_id) VALUES ('1','p','t','t',1,'x','y')")).rejects.toThrow(/FOREIGN KEY/i);
  });
});
