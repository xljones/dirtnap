import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LocationList from './LocationList';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    getLocations: vi.fn().mockResolvedValue([]),
    createLocation: vi.fn().mockResolvedValue({ id: 1, name: 'Cold store', box_count: 0, core_count: 0 }),
  },
}));

vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { is_readonly: false } }) }));
vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));

describe('LocationList — save and add another', () => {
  it('creates the location and keeps the form open and empty', async () => {
    render(<MemoryRouter><LocationList /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '+ New storage location' }));

    const input = () => screen.getByPlaceholderText(/storage location name/i);
    fireEvent.change(input(), { target: { value: 'Cold store' } });
    fireEvent.click(screen.getByRole('button', { name: /save and add another/i }));

    await waitFor(() => expect(api.createLocation).toHaveBeenCalledWith({ name: 'Cold store' }));
    await waitFor(() => expect(screen.getByRole('cell', { name: 'Cold store' })).toBeInTheDocument());
    expect(input()).toHaveValue('');
  });

  it('plain save closes the form', async () => {
    render(<MemoryRouter><LocationList /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '+ New storage location' }));
    fireEvent.change(screen.getByPlaceholderText(/storage location name/i), { target: { value: 'Freezer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByPlaceholderText(/storage location name/i)).not.toBeInTheDocument());
  });
});
