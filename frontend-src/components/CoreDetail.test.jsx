import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CoreDetail from './CoreDetail';

vi.mock('../api.js', () => ({
  api: {
    getCore: vi.fn().mockResolvedValue({
      id: 1, barcode: 'CR-001', site_name: 'North Sea', sample_type: 'Piston core',
      latitude: null, longitude: null, depth_cm: null,
      tubes: [
        { id: 10, barcode: 'T-OWN', site_name: 'Own site', sample_type: 'Sand', box_id: null },
        { id: 11, barcode: 'T-INH', site_name: null, sample_type: null, box_id: null },
      ],
    }),
    getCoreHistory: vi.fn().mockResolvedValue([]),
    getLocations: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { is_readonly: false } }) }));
vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));
vi.mock('./LeafletMap.jsx', () => ({ default: () => null }));

describe('CoreDetail — tube table', () => {
  it('shows values a tube inherits from the core, marked as inherited', async () => {
    render(
      <MemoryRouter initialEntries={['/cores/1']}>
        <Routes><Route path="/cores/:id" element={<CoreDetail />} /></Routes>
      </MemoryRouter>
    );
    const row = barcode => screen.getByText(barcode).closest('tr');
    await waitFor(() => screen.getByText('T-INH'));

    expect(within(row('T-OWN')).getByText('Own site')).toBeInTheDocument();
    expect(within(row('T-OWN')).queryByText('inherited')).not.toBeInTheDocument();

    expect(within(row('T-INH')).getByText('North Sea')).toBeInTheDocument();
    expect(within(row('T-INH')).getByText('Piston core')).toBeInTheDocument();
    expect(within(row('T-INH')).getAllByText('inherited')).toHaveLength(2);
  });
});
