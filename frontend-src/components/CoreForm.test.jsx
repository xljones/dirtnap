import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CoreForm from './CoreForm';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    getLocations: vi.fn().mockResolvedValue([{ id: 7, name: 'Cold store' }]),
    createCore: vi.fn().mockResolvedValue({ id: 50, barcode: 'CR-100' }),
  },
}));

vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));
vi.mock('./MapPicker.jsx', () => ({ default: () => null }));
vi.mock('./BarcodeInput.jsx', () => ({
  default: ({ value, onChange }) => (
    <input value={value} onChange={e => onChange(e.target.value)} data-testid="barcode-input" />
  ),
}));

const field = label =>
  screen.getByText(label, { selector: 'label' }).parentElement.querySelector('input, select, textarea');

describe('CoreForm — create and add another', () => {
  it('creates the core and resets the form, keeping location, site, date, type, collector, owner and coordinates', async () => {
    render(
      <MemoryRouter initialEntries={['/cores/new']}>
        <Routes><Route path="/cores/new" element={<CoreForm />} /></Routes>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByRole('option', { name: 'Cold store' }));

    const kept = {
      'Storage location': '7', 'Site name': 'North Sea', 'Collection date': '2026-10-01',
      'Sample type': 'Piston core', 'Collector': 'RV Explorer', 'Owner': 'Lab A',
    };
    const cleared = { 'Name': 'Core A', 'Total depth (cm)': '300', 'Notes': 'notes' };
    fireEvent.change(screen.getByTestId('barcode-input'), { target: { value: 'CR-100' } });
    for (const [label, value] of Object.entries({ ...kept, ...cleared })) {
      fireEvent.change(field(label), { target: { value } });
    }
    fireEvent.change(screen.getByPlaceholderText('e.g. 39.0968'), { target: { value: '56.8' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. -120.0324'), { target: { value: '3.1' } });

    fireEvent.click(screen.getByRole('button', { name: /create core and add another/i }));

    await waitFor(() => expect(api.createCore).toHaveBeenCalledTimes(1));
    expect(api.createCore.mock.calls[0][0]).toMatchObject({ barcode: 'CR-100', location_id: 7, depth_cm: 300 });

    await waitFor(() => expect(screen.getByTestId('barcode-input')).toHaveValue(''));
    for (const [label, value] of Object.entries(kept)) expect(field(label)).toHaveValue(value);
    expect(field('Name')).toHaveValue('');
    expect(field('Total depth (cm)')).toHaveValue(null);
    expect(field('Notes')).toHaveValue('');
    expect(screen.getByPlaceholderText('e.g. 39.0968')).toHaveValue(56.8);
    expect(screen.getByPlaceholderText('e.g. -120.0324')).toHaveValue(3.1);
    expect(screen.getByRole('heading', { name: 'New core' })).toBeInTheDocument();
  });
});
