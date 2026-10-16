import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import BoxList from './BoxList';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    getBoxes: vi.fn().mockResolvedValue([]),
    getLocations: vi.fn().mockResolvedValue([{ id: 7, name: 'Cold store' }]),
    createBox: vi.fn().mockResolvedValue({ id: 3, barcode: 'BOX-NEW' }),
  },
}));

vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { is_readonly: false } }) }));
vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));
vi.mock('./BarcodeInput.jsx', () => ({
  default: ({ value, onChange }) => (
    <input value={value} onChange={e => onChange(e.target.value)} data-testid="barcode-input" />
  ),
}));

const field = label =>
  screen.getByText(label, { selector: 'label' }).parentElement.querySelector('input, select');

describe('BoxList — save and add another', () => {
  it('creates the box and keeps only the storage location', async () => {
    render(<MemoryRouter initialEntries={['/boxes?add=1']}><BoxList /></MemoryRouter>);
    await waitFor(() => screen.getByRole('option', { name: 'Cold store' }));

    fireEvent.change(screen.getByTestId('barcode-input'), { target: { value: 'BOX-NEW' } });
    fireEvent.change(field('Name'), { target: { value: 'Shelf B' } });
    fireEvent.change(field('Storage location'), { target: { value: '7' } });
    fireEvent.change(field('Notes'), { target: { value: 'fragile' } });

    fireEvent.click(screen.getByRole('button', { name: /save box and add another/i }));

    await waitFor(() => expect(api.createBox).toHaveBeenCalledWith({
      barcode: 'BOX-NEW', name: 'Shelf B', location_id: '7', notes: 'fragile',
    }));
    await waitFor(() => expect(screen.getByTestId('barcode-input')).toHaveValue(''));
    expect(field('Name')).toHaveValue('');
    expect(field('Notes')).toHaveValue('');
    expect(field('Storage location')).toHaveValue('7');
    await waitFor(() => expect(api.getBoxes).toHaveBeenCalledTimes(2));
  });
});
