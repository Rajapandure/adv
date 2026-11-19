import { BaseRepository } from '../repositories/BaseRepository';
import type { ListOptions, Repository, Row } from '../repositories/Repository';
import { TABLES, type TableName } from '../schema';
import { inTransaction } from './migrations';
import type { SqlDriver, SqlValue } from './SqlDriver';

/** Serialises access: one connection can only run one transaction at a time. */
export class SqlLock {
  private tail: Promise<unknown> = Promise.resolve();
  run<T>(fn: () => Promise<T>): Promise<T> {
    const p = this.tail.then(() => fn());
    this.tail = p.catch(() => undefined);
    return p;
  }
}

const COLS = (t: TableName) => ['id', 'profile_id', 'created_at', 'updated_at', 'deleted_at', 'version', ...TABLES[t].columns.map((c) => c.name)];

export class SqliteRepository extends BaseRepository {
  constructor(private readonly d: SqlDriver, profileId: string, private readonly lock = new SqlLock(), private readonly inTx = false) {
    super(profileId);
  }

  protected read<T>(fn: () => Promise<T>) { return this.inTx ? fn() : this.lock.run(fn); }
  protected write<T>(fn: () => Promise<T>) { return this.inTx ? fn() : this.lock.run(() => inTransaction(this.d, fn)); }
  transaction<T>(fn: (tx: Repository) => Promise<T>): Promise<T> {
    if (this.inTx) return fn(this);
    return this.lock.run(() => inTransaction(this.d, () => fn(new SqliteRepository(this.d, this.profileId, this.lock, true))));
  }

  private fromSql(t: TableName, r: Record<string, unknown>): Row {
    const row = { ...r } as Row;
    for (const c of TABLES[t].columns) if (c.kind === 'json' && typeof row[c.name] === 'string') row[c.name] = JSON.parse(row[c.name] as string);
    return row;
  }
  private toParams(t: TableName, row: Row): SqlValue[] {
    return COLS(t).map((n) => {
      const v = row[n];
      const c = TABLES[t].columns.find((x) => x.name === n);
      return c?.kind === 'json' && v !== null ? JSON.stringify(v) : (v as SqlValue);
    });
  }
  private where(o: ListOptions): { sql: string; params: SqlValue[] } {
    const parts = ['profile_id = ?'];
    const params: SqlValue[] = [this.profileId];
    if (!o.includeDeleted) parts.push('deleted_at IS NULL');
    for (const [k, v] of Object.entries(o.where ?? {})) {
      if (v === null) parts.push(`${k} IS NULL`); else { parts.push(`${k} = ?`); params.push(v); }
    }
    return { sql: parts.join(' AND '), params };
  }

  protected async rawGet(table: TableName, id: string, includeDeleted: boolean) {
    const [r] = await this.d.all(`SELECT * FROM ${table} WHERE id = ? AND profile_id = ?${includeDeleted ? '' : ' AND deleted_at IS NULL'}`, [id, this.profileId]);
    return r ? this.fromSql(table, r) : null;
  }
  protected async rawInsert(table: TableName, row: Row) {
    const cols = COLS(table);
    await this.d.run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, this.toParams(table, row));
  }
  protected async rawReplace(table: TableName, row: Row) {
    const cols = COLS(table).filter((c) => c !== 'id');
    const params = this.toParams(table, row);
    await this.d.run(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ? AND profile_id = ?`, [...params.slice(1), row.id, this.profileId]);
  }
  protected async rawQuery(table: TableName, o: ListOptions) {
    const w = this.where(o);
    const ob = o.orderBy ?? { column: 'id' };
    let sql = `SELECT * FROM ${table} WHERE ${w.sql} ORDER BY ${ob.column} ${ob.dir === 'desc' ? 'DESC' : 'ASC'}, id ASC`;
    if (o.limit !== undefined || o.offset) { sql += ' LIMIT ? OFFSET ?'; w.params.push(o.limit ?? -1, o.offset ?? 0); }
    return (await this.d.all(sql, w.params)).map((r) => this.fromSql(table, r));
  }
  protected async rawCount(table: TableName, o: ListOptions) {
    const w = this.where(o);
    const [r] = await this.d.all(`SELECT COUNT(*) AS n FROM ${table} WHERE ${w.sql}`, w.params);
    return Number(r.n);
  }
}
