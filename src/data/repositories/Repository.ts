import type { TableName } from '../schema';

export type Scalar = string | number | null;
export interface Row {
  id: string; profile_id: string; created_at: string; updated_at: string; deleted_at: string | null; version: number;
  [column: string]: unknown;
}
export interface ListOptions {
  where?: Record<string, Scalar>;
  includeDeleted?: boolean;
  orderBy?: { column: string; dir?: 'asc' | 'desc' };
  limit?: number; offset?: number;
}

/** The only way application code reaches storage. Identical behaviour on web (Dexie) and Android (SQLite). */
export interface Repository {
  readonly profileId: string;
  create(table: TableName, data: Record<string, unknown>): Promise<Row>;
  get(table: TableName, id: string, opts?: { includeDeleted?: boolean }): Promise<Row | null>;
  /** Pass expectedVersion to detect concurrent edits (throws ConflictError). */
  update(table: TableName, id: string, patch: Record<string, unknown>, expectedVersion?: number): Promise<Row>;
  /** Soft delete. Refuses (ReferentialError) while live rows still reference this one. */
  softDelete(table: TableName, id: string): Promise<void>;
  restore(table: TableName, id: string): Promise<void>;
  list(table: TableName, opts?: ListOptions): Promise<Row[]>;
  count(table: TableName, opts?: Pick<ListOptions, 'where' | 'includeDeleted'>): Promise<number>;
  /** Atomic, gap-free counter per scope, e.g. nextSequence('receipt','RCPT-') -> RCPT-0001. */
  nextSequence(scope: string, prefix?: string): Promise<{ value: number; formatted: string }>;
  /** All-or-nothing. Throwing inside rolls everything back. */
  transaction<T>(fn: (tx: Repository) => Promise<T>): Promise<T>;
}

export class RepositoryError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = `Repo${code}`; /* distinct from Dexie's own error names */ }
}
export class ValidationError extends RepositoryError { constructor(m: string) { super('ValidationError', m); } }
export class ReferentialError extends RepositoryError { constructor(m: string) { super('ReferentialError', m); } }
export class ConflictError extends RepositoryError { constructor(m: string) { super('ConflictError', m); } }
export class NotFoundError extends RepositoryError { constructor(m: string) { super('NotFoundError', m); } }
export class SchemaTooNewError extends RepositoryError { constructor(m: string) { super('SchemaTooNewError', m); } }
