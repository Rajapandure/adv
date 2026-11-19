import type { Repository } from '@/data/repositories/Repository';
import { ClientService } from './clients';
import { DashboardService } from './dashboard';
import { SearchService } from './search';
import { CaseService } from './cases';
import { CategoryService, CourtService } from './courts';

export interface Services { repo: Repository; clients: ClientService; dashboard: DashboardService; search: SearchService; cases: CaseService; courts: CourtService; categories: CategoryService }
export function createServices(repo: Repository): Services {
  return { repo, clients: new ClientService(repo), dashboard: new DashboardService(repo), search: new SearchService(repo),
    cases: new CaseService(repo), courts: new CourtService(repo), categories: new CategoryService(repo) };
}
