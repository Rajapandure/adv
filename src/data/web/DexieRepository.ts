import Dexie, { type Table } from 'dexie';
import { BaseRepository } from '../repositories/BaseRepository';
import type { ListOptions, Repository, Row } from '../repositories/Repository';
import { TABLES, TABLE_NAMES, SCHEMA_VERSION, type TableName } from '../schema';
import { compareValues } from '../repositories/compare';

export function dexieStores(): Record<string, string> {
  return Object.fromEntries(TABLE_NAMES.map((t) => [
    t, ['id', 'profile_id', ...TABLES[t].columns.filter((c) => c.indexed).map((c) => `[profile_id+${c.name}]`)].join(', '),
  ]));
}

/** Opens the web database. Add `db.version(n+1).stores(...).upgrade(...)` here for every future schema change. */
export function openAdvocateDb(name = 'advocate-crm'): Dexie {
  const db = new Dexie(name);
  db.version(SCHEMA_VERSION).stores(dexieStores());
  return db;
}

export class DexieRepository extends BaseRepository {
  constructor(private readonly db: Dexie, profileId: string, private readonly inTx = false) { super(profileId); }
  private t(table: TableName): Table<Row, string> { return this.db.table(table); }

  /**
   * Dexie keeps an "ambient" transaction on async continuations, so code that runs after a transaction has finished
   * can be wrongly attributed to it (TransactionInactiveError). Top-level calls therefore always escape any ambient
   * transaction; calls made through the transaction-scoped repository (inTx) join the live one explicitly.
   */
  protected read<T>(fn: () => Promise<T>): Promise<T> {
    return this.inTx ? fn() : Dexie.ignoreTransaction(fn);
  }
  protected write<T>(fn: () => Promise<T>): Promise<T> {
    const run = () => this.db.transaction('rw', this.db.tables, fn) as Promise<T>; // nested calls join the parent transaction
    return this.inTx ? run() : Dexie.ignoreTransaction(run);
  }
  transaction<T>(fn: (tx: Repository) => Promise<T>): Promise<T> {
    if (this.inTx) return fn(this);
    const scoped = new DexieRepository(this.db, this.profileId, true);
    return Dexie.ignoreTransaction(() => this.db.transaction('rw', this.db.tables, () => fn(scoped)) as Promise<T>);
  }

  // Raw primitives return Dexie promises (not native async functions) so the transaction zone survives between steps.
  protected rawGet(table: TableName, id: string, includeDeleted: boolean): Promise<Row | null> {
    return this.t(table).get(id).then((row) =>
      !row || row.profile_id !== this.profileId || (!includeDeleted && row.deleted_at !== null) ? null : { ...row }) as Promise<Row | null>;
  }
  protected rawInsert(table: TableName, row: Row): Promise<void> { return this.t(table).add({ ...row }).then(() => undefined) as Promise<void>; }
  protected rawReplace(table: TableName, row: Row): Promise<void> { return this.t(table).put({ ...row }).then(() => undefined) as Promise<void>; }

  protected rawQuery(table: TableName, o: ListOptions): Promise<Row[]> {
    const eq = o.where ?? {};
    const def = TABLES[table];
    const key = Object.keys(eq).find((k) => eq[k] !== null && def.columns.some((c) => c.name === k && c.indexed));
    const coll = key
      ? this.t(table).where(`[profile_id+${key}]`).equals([this.profileId, eq[key] as string | number])
      : this.t(table).where('profile_id').equals(this.profileId);
    return coll.toArray().then((all) => {
      let rows = all.filter((r) => (o.includeDeleted || r.deleted_at === null) && Object.entries(eq).every(([k, v]) => (r[k] ?? null) === v));
      const ob = o.orderBy ?? { column: 'id' };
      const sign = ob.dir === 'desc' ? -1 : 1;
      rows.sort((a, b) => sign * compareValues(a[ob.column], b[ob.column]) || compareValues(a.id, b.id));
      if (o.offset || o.limit !== undefined) rows = rows.slice(o.offset ?? 0, o.limit === undefined ? undefined : (o.offset ?? 0) + o.limit);
      return rows.map((r) => ({ ...r }));
    }) as Promise<Row[]>;
  }
  protected rawCount(table: TableName, o: ListOptions): Promise<number> {
    return this.rawQuery(table, { ...o, orderBy: undefined, limit: undefined, offset: undefined }).then((r) => r.length);
  }
}
export { type TableName };
