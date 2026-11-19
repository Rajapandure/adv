import { uuidv7 } from '@/domain/id';
import { COMMON_COLUMNS, TABLES, column, dependentsOf, isTable, type Column, type TableName } from '../schema';
import {
  ConflictError, NotFoundError, ReferentialError, ValidationError,
  type ListOptions, type Repository, type Row, type Scalar,
} from './Repository';

type Ref = { table: TableName; id: string; via: string };
const COMMON = new Set<string>(COMMON_COLUMNS);

function checkValue(table: string, c: Column, v: unknown): void {
  const where = `${table}.${c.name}`;
  if (v === null) {
    if (!c.nullable) throw new ValidationError(`${where} is required`);
    return;
  }
  if (c.kind === 'text') {
    if (typeof v !== 'string') throw new ValidationError(`${where} must be text`);
    if (!c.nullable && v.trim() === '') throw new ValidationError(`${where} is required`);
  } else if (c.kind === 'int') {
    if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new ValidationError(`${where} must be a whole number (money is stored as integer paise)`);
  } else if (JSON.stringify(v) === undefined) throw new ValidationError(`${where} must be JSON-serialisable`);
}

function refsOf(table: TableName, row: Record<string, unknown>, only?: Iterable<string>): Ref[] {
  const names = only ? new Set(only) : null;
  return TABLES[table].columns
    .filter((c) => c.ref && (!names || names.has(c.name)) && row[c.name] !== null && row[c.name] !== undefined)
    .map((c) => ({ table: c.ref as TableName, id: row[c.name] as string, via: `${table}.${c.name}` }));
}

/**
 * Business rules shared by both adapters (validation, FK integrity, versioning, soft delete, sequences).
 * Adapters only supply raw storage primitives and a transaction strategy, so behaviour cannot diverge.
 */
export abstract class BaseRepository implements Repository {
  constructor(readonly profileId: string) {}

  // ---- primitives supplied by adapters (never call from UI code) ----
  protected abstract rawGet(table: TableName, id: string, includeDeleted: boolean): Promise<Row | null>;
  protected abstract rawInsert(table: TableName, row: Row): Promise<void>;
  protected abstract rawReplace(table: TableName, row: Row): Promise<void>;
  protected abstract rawQuery(table: TableName, o: ListOptions): Promise<Row[]>;
  protected abstract rawCount(table: TableName, o: ListOptions): Promise<number>;
  protected abstract read<T>(fn: () => Promise<T>): Promise<T>;
  protected abstract write<T>(fn: () => Promise<T>): Promise<T>;
  abstract transaction<T>(fn: (tx: Repository) => Promise<T>): Promise<T>;

  // ---- helpers ----
  private assertTable(t: string): asserts t is TableName {
    if (!isTable(t)) throw new ValidationError(`Unknown table "${t}"`);
  }
  private checkWhere(table: TableName, where?: Record<string, Scalar>) {
    for (const k of Object.keys(where ?? {})) {
      if (!column(table, k) && !COMMON.has(k)) throw new ValidationError(`Unknown column ${table}.${k}`);
    }
  }
  private checkList(table: TableName, o: ListOptions) {
    this.checkWhere(table, o.where);
    const ob = o.orderBy?.column;
    if (ob && !column(table, ob) && !COMMON.has(ob)) throw new ValidationError(`Unknown column ${table}.${ob}`);
  }
  private async assertRefs(refs: Ref[]) {
    if (refs.length === 0) return;
    for (const r of refs) {
      if (!(await this.rawGet(r.table, r.id, false))) {
        throw new ReferentialError(`${r.via} points to a missing or deleted ${r.table} record`);
      }
    }
  }
  private async mustGet(table: TableName, id: string, includeDeleted = false): Promise<Row> {
    const row = await this.rawGet(table, id, includeDeleted);
    if (!row) throw new NotFoundError(`${table} ${id} not found`);
    return row;
  }

  // ---- public API ----
  async create(table: TableName, data: Record<string, unknown>): Promise<Row> {
    this.assertTable(table);
    return this.write(async () => {
      for (const k of Object.keys(data)) {
        if (COMMON.has(k)) throw new ValidationError(`${table}.${k} is managed by the repository`);
        if (!column(table, k)) throw new ValidationError(`Unknown column ${table}.${k}`);
      }
      const now = new Date().toISOString();
      const row: Row = { id: uuidv7(), profile_id: this.profileId, created_at: now, updated_at: now, deleted_at: null, version: 1 };
      for (const c of TABLES[table].columns) {
        let v = data[c.name];
        if (v === undefined) v = c.default !== undefined ? c.default : null;
        checkValue(table, c, v);
        row[c.name] = v;
      }
      const refs = refsOf(table, row);
      if (refs.length) await this.assertRefs(refs);
      await this.rawInsert(table, row);
      return { ...row };
    });
  }

  async get(table: TableName, id: string, opts?: { includeDeleted?: boolean }): Promise<Row | null> {
    this.assertTable(table);
    return this.read(() => this.rawGet(table, id, Boolean(opts?.includeDeleted)));
  }

  async update(table: TableName, id: string, patch: Record<string, unknown>, expectedVersion?: number): Promise<Row> {
    this.assertTable(table);
    return this.write(async () => {
      const existing = await this.mustGet(table, id);
      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        throw new ConflictError(`${table} ${id} was changed elsewhere (have v${existing.version}, expected v${expectedVersion})`);
      }
      const next: Row = { ...existing };
      for (const [k, v] of Object.entries(patch)) {
        if (COMMON.has(k)) throw new ValidationError(`${table}.${k} cannot be changed`);
        const c = column(table, k);
        if (!c) throw new ValidationError(`Unknown column ${table}.${k}`);
        const value = v === undefined ? null : v;
        checkValue(table, c, value);
        next[k] = value;
      }
      const refs = refsOf(table, next, Object.keys(patch));
      if (refs.length) await this.assertRefs(refs);
      next.version = existing.version + 1;
      next.updated_at = new Date().toISOString();
      await this.rawReplace(table, next);
      return { ...next };
    });
  }

  async softDelete(table: TableName, id: string): Promise<void> {
    this.assertTable(table);
    return this.write(async () => {
      const existing = await this.mustGet(table, id);
      for (const d of dependentsOf(table)) {
        const n = await this.rawCount(d.table, { where: { [d.column]: id } });
        if (n > 0) throw new ReferentialError(`Cannot delete ${table} ${id}: ${n} live ${d.table} record(s) still reference it`);
      }
      const now = new Date().toISOString();
      await this.rawReplace(table, { ...existing, deleted_at: now, updated_at: now, version: existing.version + 1 });
    });
  }

  async restore(table: TableName, id: string): Promise<void> {
    this.assertTable(table);
    return this.write(async () => {
      const existing = await this.mustGet(table, id, true);
      if (existing.deleted_at === null) return;
      await this.assertRefs(refsOf(table, existing));
      await this.rawReplace(table, { ...existing, deleted_at: null, updated_at: new Date().toISOString(), version: existing.version + 1 });
    });
  }

  async list(table: TableName, opts: ListOptions = {}): Promise<Row[]> {
    this.assertTable(table);
    this.checkList(table, opts);
    return this.read(() => this.rawQuery(table, opts));
  }

  async count(table: TableName, opts: Pick<ListOptions, 'where' | 'includeDeleted'> = {}): Promise<number> {
    this.assertTable(table);
    this.checkWhere(table, opts.where);
    return this.read(() => this.rawCount(table, opts));
  }

  async nextSequence(scope: string, prefix = ''): Promise<{ value: number; formatted: string }> {
    return this.write(async () => {
      const [existing] = await this.rawQuery('number_sequences', { where: { scope }, limit: 1 });
      let value: number;
      if (existing) {
        value = existing.next_value as number;
        await this.rawReplace('number_sequences', { ...existing, next_value: value + 1, version: existing.version + 1, updated_at: new Date().toISOString() });
      } else {
        value = 1;
        const now = new Date().toISOString();
        await this.rawInsert('number_sequences', { id: uuidv7(), profile_id: this.profileId, created_at: now, updated_at: now, deleted_at: null, version: 1, scope, prefix: prefix || null, next_value: 2 });
      }
      return { value, formatted: `${prefix}${String(value).padStart(4, '0')}` };
    });
  }
}
