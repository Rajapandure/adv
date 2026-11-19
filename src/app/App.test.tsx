import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import { DataProvider } from './DataProvider';
import { DexieRepository, openAdvocateDb } from '@/data/web/DexieRepository';
import { useLang } from '@/i18n/store';
import { useToasts } from '@/design-system';
import { createServices } from '@/services';

let n = 0;
async function setup(path = '/', seed?: (s: ReturnType<typeof createServices>) => Promise<void>) {
  const db = openAdvocateDb(`ui-${n++}`);
  await db.open();
  const repo = new DexieRepository(db, 'p');
  const services = createServices(repo);
  if (seed) await seed(services);
  return { db, services, repo, ...render(<MemoryRouter initialEntries={[path]}><DataProvider repo={repo}><App /></DataProvider></MemoryRouter>) };
}
beforeEach(() => { localStorage.clear(); useLang.setState({ lang: 'en' }); useToasts.setState({ toasts: [] }); });

async function fillClient(name: string, phone: string) {
  await userEvent.type(screen.getByLabelText(/Full name/), name);
  await userEvent.type(screen.getByLabelText('Phone', { exact: false, selector: 'input[inputmode="tel"]:not([name="alt_phone"])' }), phone);
}

describe('app shell', () => {
  it('renders navigation, the dashboard and an empty-state activity feed', async () => {
    await setup();
    expect(await screen.findByText('Total clients')).toBeInTheDocument();
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /clients/i }).length).toBeGreaterThan(0);
  });
  it('shows a placeholder for modules not built yet', async () => {
    await setup('/documents');
    expect(await screen.findByText(/scheduled for Stage 7/)).toBeInTheDocument();
  });
  it('switches to Hindi and remembers the choice', async () => {
    await setup('/clients');
    await userEvent.click(screen.getByRole('button', { name: 'Change language' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'मुवक्किल' })).toBeInTheDocument();
    expect(localStorage.getItem('advocate-crm:lang')).toBe('hi');
  });
});

describe('client management', () => {
  it('shows validation errors and saves nothing for bad input', async () => {
    const { db } = await setup('/clients');
    await userEvent.click(screen.getAllByRole('button', { name: 'New client' })[0]);
    await userEvent.type(screen.getByLabelText(/Full name/), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findAllByRole('alert')).not.toHaveLength(0);
    expect(screen.getByText('Enter at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid 10-digit Indian mobile number')).toBeInTheDocument();
    expect(await db.table('clients').count()).toBe(0);
  });

  it('creates a client, lists it, opens its page and archives it after confirmation', async () => {
    const { db } = await setup('/clients');
    await userEvent.click(screen.getAllByRole('button', { name: 'New client' })[0]);
    await fillClient('Asha Verma', '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Client saved')).toBeInTheDocument();
    const row = (await screen.findAllByText('Asha Verma'))[0];
    expect(await db.table('clients').count()).toBe(1);
    expect(screen.getAllByText('CL-0001').length).toBeGreaterThan(0);

    await userEvent.click(row);
    expect(await screen.findByRole('heading', { level: 1, name: 'Asha Verma' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    const dialog = screen.getByRole('dialog', { name: 'Archive client' });
    expect((await db.table('clients').toArray())[0].archived).toBe(0); // nothing happens before confirming
    await userEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(async () => expect((await db.table('clients').toArray())[0].archived).toBe(1));
    expect(await screen.findByRole('button', { name: 'Restore' })).toBeInTheDocument();
  });

  it('warns about a duplicate phone number and lets the user go back', async () => {
    const { db } = await setup('/clients');
    for (let i = 0; i < 2; i++) {
      await userEvent.click(screen.getAllByRole('button', { name: 'New client' })[0]);
      await fillClient(i ? 'Someone Else' : 'Asha Verma', '9876543210');
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      if (i === 0) await screen.findByText('Client saved');
    }
    const warn = await screen.findByRole('dialog', { name: 'Phone number already used' });
    expect(warn).toHaveTextContent('Asha Verma already has this phone number');
    await userEvent.click(within(warn).getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByLabelText(/Full name/)).toHaveValue('Someone Else'); // form keeps what was typed
    expect(await db.table('clients').count()).toBe(1);
  });

  it('finds clients through the global search and opens them', async () => {
    const { db } = await setup('/clients');
    await userEvent.click(screen.getAllByRole('button', { name: 'New client' })[0]);
    await fillClient('Ravi Jain', '9123456780');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Client saved');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Global search' }), 'ravi');
    await userEvent.click(await screen.findByRole('option', { name: /Ravi Jain/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ravi Jain' })).toBeInTheDocument();
    expect(await db.table('audit_logs').count()).toBe(1);
  });
});

const person = { type: 'individual' as const, name: 'Asha Verma', phone: '9876543210', alt_phone: '', email: '', address: '', city: '', state: '', pin: '', notes: '' };

describe('case management', () => {
  it('validates, creates a case linked to a client, and manages clients, parties and status', async () => {
    const { db } = await setup('/cases', async (s) => { await s.clients.create(person); await s.clients.create({ ...person, name: 'Ravi Jain', phone: '9123456780' }); });
    await userEvent.click(screen.getAllByRole('button', { name: 'New case' })[0]);
    await userEvent.type(screen.getByLabelText(/Case title/), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter at least 3 characters')).toBeInTheDocument();
    expect(await db.table('cases').count()).toBe(0);

    await userEvent.type(screen.getByLabelText(/Case title/), 'c v. State');
    await userEvent.selectOptions(screen.getByLabelText('Client'), (await screen.findAllByRole('option', { name: /Asha Verma/ }))[0]);
    await userEvent.type(screen.getByLabelText('CNR number'), 'mpsg010012342026');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'abc v. State' })).toBeInTheDocument();
    expect(screen.getByText('ADV-0001')).toBeInTheDocument();
    expect((await db.table('cases').toArray())[0].cnr).toBe('MPSG010012342026');

    await userEvent.click(screen.getByRole('tab', { name: 'Clients & parties' }));
    expect(await screen.findByRole('link', { name: 'Asha Verma' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Choose a client'), await screen.findByRole('option', { name: 'Ravi Jain' }));
    await userEvent.click(screen.getByRole('button', { name: 'Link client' }));
    expect(await screen.findByRole('link', { name: 'Ravi Jain' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name'), 'State of M.P.');
    await userEvent.click(screen.getByRole('button', { name: 'Add party' }));
    expect(await screen.findByText('State of M.P.')).toBeInTheDocument();
    expect(await db.table('case_clients').count()).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: 'Remove Ravi Jain' }));
    expect(await db.table('case_clients').count()).toBe(2); // not removed until confirmed
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Ravi Jain' })).toBeNull());

    await userEvent.click(screen.getByRole('button', { name: 'Mark closed' }));
    expect(await screen.findByRole('button', { name: 'Reopen' })).toBeInTheDocument();
    expect((await db.table('cases').toArray())[0].status).toBe('closed');
  });

  it('adds a custom court and refuses to remove one that a case uses', async () => {
    const { db } = await setup('/courts');
    await userEvent.click(screen.getAllByRole('button', { name: 'New court' })[0]);
    await userEvent.type(screen.getByLabelText(/Name/), 'Family Court Bhopal');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findAllByText('Family Court Bhopal')).length).toBeGreaterThan(0);
    const court = (await db.table('courts').toArray())[0];
    await db.table('cases').add({ id: 'c1', profile_id: 'p', created_at: 't', updated_at: 't', deleted_at: null, version: 1, internal_no: 'X', title: 'Uses court', status: 'active', court_id: court.id });
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove Family Court Bhopal' })[0]);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText(/used by cases/)).toBeInTheDocument();
    expect((await db.table('courts').toArray())[0].deleted_at).toBeNull();
  });

  it('manages case categories from the cases page', async () => {
    await setup('/cases');
    await userEvent.click(await screen.findByRole('button', { name: 'Manage categories' }));
    expect(await screen.findByText('Criminal')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Category name'), 'Arbitration');
    await userEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(await screen.findByText('Arbitration')).toBeInTheDocument();
  });
});
