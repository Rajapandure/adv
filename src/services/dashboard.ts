import type { Repository, Row } from '@/data/repositories/Repository';
import { addDays, type ISODate } from '@/domain/dates';
import { sumPaise, type Paise } from '@/domain/money';

export interface DashboardStats {
  clients: number; activeCases: number; closedCases: number; todaysHearings: number; upcomingHearings: number;
  pendingTasks: number; outstandingPaise: Paise; monthlyCollectionPaise: Paise; recent: Row[];
}

export class DashboardService {
  constructor(private readonly repo: Repository) {}

  async stats(today: ISODate): Promise<DashboardStats> {
    const r = this.repo;
    const weekEnd = addDays(today, 7);
    const [clients, activeCases, closedCases, todays, hearings, pendingTasks, fees, payments, recent] = await Promise.all([
      r.count('clients', { where: { archived: 0 } }),
      r.count('cases', { where: { status: 'active' } }),
      r.count('cases', { where: { status: 'closed' } }),
      r.count('hearings', { where: { hearing_date: today } }),
      r.list('hearings'),
      r.count('tasks', { where: { status: 'pending' } }),
      r.list('fee_records'),
      r.list('payments'),
      r.list('audit_logs', { orderBy: { column: 'at', dir: 'desc' }, limit: 8 }),
    ]);
    const paidBy = new Map<string, number>();
    for (const p of payments) paidBy.set(p.fee_record_id as string, (paidBy.get(p.fee_record_id as string) ?? 0) + (p.amount_paise as number));
    const outstanding = sumPaise(fees.map((f) => Math.max(0, (f.agreed_paise as number) - (paidBy.get(f.id) ?? 0))));
    const month = today.slice(0, 7);
    const monthly = sumPaise(payments.filter((p) => String(p.paid_on).startsWith(month)).map((p) => p.amount_paise as number));
    const upcoming = hearings.filter((h) => (h.hearing_date as string) > today && (h.hearing_date as string) <= weekEnd).length;
    return { clients, activeCases, closedCases, todaysHearings: todays, upcomingHearings: upcoming, pendingTasks, outstandingPaise: outstanding, monthlyCollectionPaise: monthly, recent };
  }
}
