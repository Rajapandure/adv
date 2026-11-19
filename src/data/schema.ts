/**
 * Single source of truth for the v1 schema. Both persistence adapters are generated from / validated against it,
 * so web (Dexie) and Android (SQLite) cannot drift apart.
 *
 * Column token grammar:  name[#int | @json][?nullable][>fk_table][*indexed][=default]
 * Every table also has: id, profile_id, created_at, updated_at, deleted_at (soft delete), version (optimistic lock).
 * Money columns are `#` integers holding paise. Foreign-key columns are always indexed.
 */
export const SCHEMA_VERSION = 1;
export const COMMON_COLUMNS = ['id', 'profile_id', 'created_at', 'updated_at', 'deleted_at', 'version'] as const;

const SPEC = {
  app_settings: 'key* value@?',
  case_categories: 'name* sort_order#=0',
  team_members: 'name* role? phone? email? active#=1',
  courts: 'name* court_type? district? state? address? bench? courtroom? judge?',
  clients: 'client_no?* type=individual name* phone* alt_phone? email? address? city? state? pin? notes? archived#=0',
  cases: 'internal_no* reg_no?* case_year#? cnr?* title* category_id?>case_categories case_type? court_id?>courts district? judge? filing_date? petitioner? respondent? assigned_member_id?>team_members stage? status*=active description? connected_case_ids@?',
  case_clients: 'case_id>cases client_id>clients role?',
  case_parties: 'case_id>cases name* side advocate_name? notes?',
  hearings: 'case_id>cases hearing_date* purpose? courtroom? judge? outcome? adjournment_reason? next_hearing_date?*',
  case_events: 'case_id>cases event_date* kind text',
  documents: 'case_id?>cases client_id?>clients name* doc_type? description? current_version_id?',
  case_orders: 'case_id>cases order_date* summary? document_id?>documents',
  case_deadlines: 'case_id>cases due_date* title advisory#=1 done#=0',
  document_versions: 'document_id>documents version_no# sha256 size_bytes# mime storage_key',
  document_tags: 'document_id>documents tag*',
  tasks: 'title priority=normal status*=pending due_at?* notes? case_id?>cases client_id?>clients assignee_id?>team_members',
  fee_records: 'case_id?>cases client_id>clients kind agreed_paise# description?',
  payments: 'fee_record_id>fee_records amount_paise# method? receipt_no?* paid_on*',
  expenses: 'case_id?>cases amount_paise# category? spent_on* notes?',
  legal_notes: 'title body case_id?>cases tags?',
  daily_diary: 'diary_date* entry',
  templates: 'kind* name body',
  notification_queue: 'entity_type entity_id fire_at* state*=pending',
  audit_logs: 'actor? action* entity* entity_id? at*',
  backup_history: 'taken_at* size_bytes# schema_version# checksum',
  number_sequences: 'scope* prefix? next_value#=1',
} as const;

export type TableName = keyof typeof SPEC;
export type ColKind = 'text' | 'int' | 'json';
export interface Column { name: string; kind: ColKind; nullable: boolean; indexed: boolean; ref?: string; default?: unknown }
export interface TableDef { name: TableName; columns: Column[] }

const TOKEN = /^([a-z_0-9]+)([#@])?(\?)?(?:>([a-z_]+))?(\*)?(?:=(.*))?$/;

function parse(name: TableName, spec: string): TableDef {
  const columns = spec.split(/\s+/).map((tok): Column => {
    const m = TOKEN.exec(tok);
    if (!m) throw new Error(`Bad column token "${tok}" in ${name}`);
    const [, n, k, q, ref, star, def] = m;
    const kind: ColKind = k === '#' ? 'int' : k === '@' ? 'json' : 'text';
    return {
      name: n, kind, nullable: q === '?', ref, indexed: Boolean(star) || Boolean(ref),
      default: def === undefined ? undefined : kind === 'int' ? Number(def) : def,
    };
  });
  return { name, columns };
}

export const TABLES = Object.fromEntries(
  (Object.keys(SPEC) as TableName[]).map((n) => [n, parse(n, SPEC[n])]),
) as Record<TableName, TableDef>;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

export function isTable(name: string): name is TableName { return Object.hasOwn(TABLES, name); }
export function column(table: TableName, name: string): Column | undefined {
  return TABLES[table].columns.find((c) => c.name === name);
}

/** Tables (and columns) that point at `table` — used for restrict-on-delete. */
export function dependentsOf(table: TableName): { table: TableName; column: string }[] {
  return TABLE_NAMES.flatMap((t) => TABLES[t].columns.filter((c) => c.ref === table).map((c) => ({ table: t, column: c.name })));
}
