/**
 * Minimal SQL surface the Android adapter needs. Stage 10 provides the Capacitor SQLite (SQLCipher) implementation;
 * tests use Node's built-in SQLite. Nothing above this interface knows which one is in use.
 */
export type SqlValue = string | number | null;
export interface SqlDriver {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all(sql: string, params?: SqlValue[]): Promise<Record<string, unknown>[]>;
}
