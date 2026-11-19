import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { App } from '@/app/App';
import { DataProvider } from '@/app/DataProvider';
import { DexieRepository, openAdvocateDb } from '@/data/web/DexieRepository';
import { createServices } from '@/services';
import { caseToInput } from '@/services/cases';
import './preview.css';

/** Preview-only entry: in-page routing, its own database, and clearly-labelled demo clients on first run. */
const DEMO = [
  { name: 'Demo: Asha Verma', phone: '9876543210', city: 'Sagar', state: 'Madhya Pradesh', type: 'individual' as const },
  { name: 'Demo: Jain Traders Pvt Ltd', phone: '9123456780', city: 'Bhopal', state: 'Madhya Pradesh', type: 'organization' as const },
];
const root = createRoot(document.getElementById('root')!);

(async () => {
  try {
    const db = openAdvocateDb('advocate-crm-preview');
    await db.open();
    const repo = new DexieRepository(db, 'preview-profile');
    if ((await repo.count('clients', { includeDeleted: true })) === 0) {
      const s = createServices(repo);
      const made = [];
      for (const d of DEMO) made.push(await s.clients.create({ ...d, alt_phone: '', email: '', address: '', pin: '', notes: 'Demo data' }));
      const court = await s.courts.create({ name: 'Demo: District Court Sagar', court_type: 'District', district: 'Sagar', state: 'Madhya Pradesh', address: '', bench: '', courtroom: '3', judge: '' });
      const [cat] = await s.categories.list();
      const c = await s.cases.create({ ...caseToInput(null), title: 'Demo: Verma v. State of M.P.', client_id: made[0].id, court_id: court.id, category_id: cat.id, filing_date: '2026-03-10', petitioner: 'Asha Verma', respondent: 'State of M.P.' });
      await s.cases.addParty(c.id, { name: 'State of M.P.', side: 'respondent' });
    }
    root.render(<MemoryRouter><DataProvider repo={repo}><App /></DataProvider></MemoryRouter>);
  } catch (e) {
    root.render(<p role="alert" style={{ padding: 24, fontFamily: 'sans-serif' }}>This preview needs browser storage, which is blocked here: {(e as Error).message}</p>);
  }
})();
