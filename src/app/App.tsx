import { Route, Routes } from 'react-router-dom';
import { Shell } from './Shell';
import { ModulePending } from './ModulePending';
import { NAV } from './nav';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { ClientsPage } from '@/features/clients/ClientsPage';
import { CasesPage } from '@/features/cases/CasesPage';
import { CaseDetailPage } from '@/features/cases/CaseDetailPage';
import { CourtsPage } from '@/features/courts/CourtsPage';
import { ClientDetailPage } from '@/features/clients/ClientDetailPage';

const BUILT = new Set(['/', '/clients', '/cases', '/courts']);

export function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<DashboardPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/:id" element={<ClientDetailPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/:id" element={<CaseDetailPage />} />
        <Route path="/courts" element={<CourtsPage />} />
        {NAV.filter((n) => !BUILT.has(n.to)).map(({ to, label, stage }) => (
          <Route key={to} path={to} element={<ModulePending label={label} stage={stage} />} />
        ))}
        <Route path="*" element={<ModulePending label="nav.dashboard" stage="Stage 4" />} />
      </Route>
    </Routes>
  );
}
