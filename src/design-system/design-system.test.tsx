import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Button, TextField, SelectField, MoneyField, Modal, ConfirmDialog, DataTable, ToastViewport, toast, useToasts } from '.';

describe('fields', () => {
  it('links label, error and aria-invalid', () => {
    render(<TextField label="Client name" required error="Name is required" />);
    const input = screen.getByLabelText(/Client name/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Name is required');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
  it('renders select options with placeholder', () => {
    render(<SelectField label="State" placeholder="Choose" options={[{ value: 'MP', label: 'Madhya Pradesh' }]} />);
    expect(screen.getByRole('option', { name: 'Madhya Pradesh' })).toBeInTheDocument();
  });
});

describe('MoneyField', () => {
  function Harness() {
    const [v, setV] = useState<number | null>(null);
    return <><MoneyField label="Fee" value={v} onChange={setV} /><output data-testid="paise">{String(v)}</output></>;
  }
  it('yields exact paise and flags invalid text', async () => {
    render(<Harness />);
    const input = screen.getByLabelText('Fee');
    await userEvent.type(input, '1,500.25');
    expect(screen.getByTestId('paise')).toHaveTextContent('150025');
    await userEvent.clear(input);
    await userEvent.type(input, '12.345');
    expect(screen.getByRole('alert')).toHaveTextContent(/Enter an amount/);
  });
});

describe('react-hook-form + zod validation', () => {
  const schema = z.object({ name: z.string().trim().min(2, 'Enter at least 2 characters') });
  function Form({ onOk }: { onOk: (n: string) => void }) {
    const { register, handleSubmit, formState: { errors } } = useForm<{ name: string }>({ resolver: zodResolver(schema) });
    return <form onSubmit={handleSubmit((d) => onOk(d.name))}>
      <TextField label="Name" error={errors.name?.message} {...register('name')} />
      <Button type="submit">Save</Button></form>;
  }
  it('shows helpful errors and submits valid data', async () => {
    const ok = vi.fn();
    render(<Form onOk={ok} />);
    await userEvent.type(screen.getByLabelText('Name'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 2');
    expect(ok).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Name'), 'sha');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(() => expect(ok).toHaveBeenCalledWith('Asha'));
  });
});

describe('Modal and ConfirmDialog', () => {
  it('closes on Escape and restores focus', async () => {
    function H() { const [o, setO] = useState(false);
      return <><button onClick={() => setO(true)}>Open</button><Modal open={o} title="Edit" onClose={() => setO(false)}><input aria-label="x" /></Modal></>; }
    render(<H />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByLabelText('Close')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });
  it('traps Tab inside the dialog', async () => {
    render(<Modal open title="T" onClose={() => {}}><input aria-label="a" /></Modal>);
    await userEvent.tab(); await userEvent.tab(); await userEvent.tab();
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });
  it('requires explicit confirmation', async () => {
    const yes = vi.fn(), no = vi.fn();
    render(<ConfirmDialog open title="Archive client" message="Sure?" confirmLabel="Archive" onConfirm={yes} onCancel={no} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(no).toHaveBeenCalled(); expect(yes).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(yes).toHaveBeenCalled();
  });
});

describe('DataTable', () => {
  const cols = [{ key: 'n', header: 'Name', render: (r: { n: string }) => r.n }];
  it('shows an empty state with guidance', () => {
    render(<DataTable rows={[]} columns={cols} rowKey={(r: { n: string }) => r.n} empty={{ title: 'No clients yet', hint: 'Add your first client.' }} />);
    expect(screen.getByText('No clients yet')).toBeInTheDocument();
  });
  it('activates rows by click and Enter', async () => {
    const open = vi.fn();
    render(<DataTable rows={[{ n: 'Asha' }]} columns={cols} rowKey={(r) => r.n} onRowClick={open} empty={{ title: '' }} />);
    const rows = screen.getAllByRole('button');
    await userEvent.click(rows[0]);
    rows[0].focus(); await userEvent.keyboard('{Enter}');
    expect(open).toHaveBeenCalledTimes(2);
  });
});

describe('toast', () => {
  it('announces success and can be dismissed', async () => {
    render(<ToastViewport />);
    act(() => toast.success('Client saved'));
    expect(screen.getByText('Client saved')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(useToasts.getState().toasts).toHaveLength(0);
  });
});
