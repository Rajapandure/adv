import { createRequire } from 'node:module';
import type { DatabaseSync as DB } from 'node:sqlite';
import type { SqlDriver, SqlValue } from '../SqlDriver';

/** Test-only driver backed by Node's built-in SQLite. Production uses the Capacitor SQLCipher driver (Stage 10). */
// createRequire avoids Vite rewriting the `node:sqlite` builtin specifier.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

export class NodeSqliteDriver implements SqlDriver {
  readonly db: DB;
  constructor(path = ':memory:') { this.db = new DatabaseSync(path); }
  async exec(sql: string) { this.db.exec(sql); }
  async run(sql: string, p: SqlValue[] = []) { return { changes: Number(this.db.prepare(sql).run(...p).changes) }; }
  async all(sql: string, p: SqlValue[] = []) { return this.db.prepare(sql).all(...p) as Record<string, unknown>[]; }
}
