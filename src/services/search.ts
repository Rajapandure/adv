import type { Repository, Row } from '@/data/repositories/Repository';
import type { TableName } from '@/data/schema';

export interface SearchHit { type: 'client' | 'case' | 'party' | 'court' | 'document' | 'task'; id: string; title: string; subtitle: string; route: string }

const SOURCES: { type: SearchHit['type']; table: TableName; fields: string[]; phone?: string[]; title: string; sub: string[]; route: (r: Row) => string }[] = [
  { type: 'client', table: 'clients', fields: ['name', 'client_no', 'email'], phone: ['phone', 'alt_phone'], title: 'name', sub: ['client_no', 'phone'], route: (r) => `/clients/${r.id}` },
  { type: 'case', table: 'cases', fields: ['title', 'internal_no', 'reg_no', 'cnr', 'petitioner', 'respondent'], title: 'title', sub: ['internal_no', 'reg_no', 'cnr'], route: (r) => `/cases/${r.id}` },
  { type: 'party', table: 'case_parties', fields: ['name'], title: 'name', sub: ['side'], route: (r) => `/cases/${String(r.case_id)}` },
  { type: 'court', table: 'courts', fields: ['name', 'district'], title: 'name', sub: ['district', 'court_type'], route: () => '/courts' },
  { type: 'document', table: 'documents', fields: ['name'], title: 'name', sub: ['doc_type'], route: () => '/documents' },
  { type: 'task', table: 'tasks', fields: ['title'], title: 'title', sub: ['status'], route: () => '/tasks' },
];

const has = (v: unknown, q: string) => typeof v === 'string' && v.toLowerCase().includes(q);

/**
 * Local, offline search. Case-insensitive substring match over the fields in the spec; phone numbers match on digits.
 * Scans each table through the repository (no query leaves the device). Fast enough for a chamber's data;
 * a dedicated index (FTS5 / token index) is scheduled for the Stage 11 performance pass.
 */
export class SearchService {
  constructor(private readonly repo: Repository) {}

  async search(query: string, perType = 5): Promise<SearchHit[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const digits = q.replace(/\D/g, '');
    const phoneQuery = digits.length >= 3 && /^[\d+\s-]+$/.test(q);
    const groups = await Promise.all(SOURCES.map(async (s) => {
      const rows = await this.repo.list(s.table);
      return rows
        .filter((r) => (phoneQuery && s.phone ? s.phone.some((f) => has(r[f], digits)) : s.fields.some((f) => has(r[f], q))))
        .slice(0, perType)
        .map((r): SearchHit => ({
          type: s.type, id: r.id, title: String(r[s.title]),
          subtitle: s.sub.map((f) => r[f]).filter((v) => typeof v === 'string' && v).join(' · '), route: s.route(r),
        }));
    }));
    return groups.flat();
  }
}
