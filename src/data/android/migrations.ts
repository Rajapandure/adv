import { SchemaTooNewError } from '../repositories/Repository';
import { TABLES, TABLE_NAMES } from '../schema';
import type { SqlDriver } from './SqlDriver';

export interface SqlMigration { version: number; description: string; statements: string[] }

export function createSchemaStatements(): string[] {
  const out: string[] = [];
  for (const name of TABLE_NAMES) {
    const cols = [
      'id TEXT PRIMARY KEY', 'profile_id TEXT NOT NULL', 'created_at TEXT NOT NULL',
      'updated_at TEXT NOT NULL', 'deleted_at TEXT', 'version INTEGER NOT NULL',
    ];
    for (const c of TABLES[name].columns) {
      let s = `${c.name} ${c.kind === 'int' ? 'INTEGER' : 'TEXT'}`;
      if (!c.nullable) s += ' NOT NULL';
      if (c.default !== undefined) s += ` DEFAULT ${typeof c.default === 'number' ? c.default : `'${String(c.default).replace(/'/g, "''")}'`}`;
      if (c.ref) s += ` REFERENCES ${c.ref}(id)`;
      cols.push(s);
    }
    out.push(`CREATE TABLE ${name} (${cols.join(', ')})`);
    out.push(`CREATE INDEX idx_${name}_profile ON ${name}(profile_id)`);
    for (const c of TABLES[name].columns.filter((x) => x.indexed)) {
      out.push(`CREATE INDEX idx_${name}_${c.name} ON ${name}(profile_id, ${c.name})`);
    }
  }
  return out;
}

/** v1 is generated from the schema definition. From v2 on, add explicit ALTER/CREATE statements here. */
export const MIGRATIONS: SqlMigration[] = [
  { version: 1, description: 'initial schema', statements: createSchemaStatements() },
];

export async function inTransaction<T>(d: SqlDriver, fn: () => Promise<T>): Promise<T> {
  await d.exec('BEGIN IMMEDIATE');
  try { const r = await fn(); await d.exec('COMMIT'); return r; }
  catch (e) { try { await d.exec('ROLLBACK'); } catch { /* already rolled back */ } throw e; }
}

/** Applies pending migrations, each in its own transaction. Refuses to open a database newer than this app. */
export async function migrateSqlite(d: SqlDriver, migrations: SqlMigration[] = MIGRATIONS): Promise<number> {
  await d.exec('PRAGMA foreign_keys = ON');
  await d.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TEXT NOT NULL)');
  const [row] = await d.all('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations');
  const current = Number(row.v);
  const latest = Math.max(0, ...migrations.map((m) => m.version));
  if (current > latest) throw new SchemaTooNewError(`Database schema v${current} is newer than this app (v${latest}). Update the app; data was not touched.`);
  for (const m of [...migrations].sort((a, b) => a.version - b.version).filter((x) => x.version > current)) {
    await inTransaction(d, async () => {
      for (const s of m.statements) await d.exec(s);
      await d.run('INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)', [m.version, m.description, new Date().toISOString()]);
    });
  }
  return latest;
}
