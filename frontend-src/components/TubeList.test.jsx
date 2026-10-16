import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TubeList from './TubeList';
import { api } from '../api.js';

vi.mock('../api.js', () => ({
  api: {
    getBoxes: vi.fn().mockResolvedValue([]),
    getTubes: vi.fn().mockResolvedValue([
      { id: 1, barcode: 'T001', box_id: 1, box_barcode: 'BOX001', site_name: 'Site A', sample_type: 'core', depth_cm: 10, sample_date: '2024-01-01' },
      { id: 2, barcode: 'T002', box_id: null, box_barcode: null, site_name: 'Site B', sample_type: null, depth_cm: null, sample_date: null },
    ]),
  },
}));

vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { is_readonly: false } }) }));
vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="/tubes" element={<TubeList />} /></Routes>
    </MemoryRouter>
  );
}

describe('TubeList', () => {
  it('shows all tubes by default', async () => {
    renderAt('/tubes');
    await waitFor(() => {
      expect(screen.getByText('T001')).toBeInTheDocument();
      expect(screen.getByText('T002')).toBeInTheDocument();
    });
  });

  it('shows "Tubes" heading by default', async () => {
    renderAt('/tubes');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tubes' })).toBeInTheDocument();
    });
  });

  it('filters to unassigned tubes when ?unassigned=true', async () => {
    renderAt('/tubes?unassigned=true');
    await waitFor(() => {
      expect(screen.queryByText('T001')).not.toBeInTheDocument();
      expect(screen.getByText('T002')).toBeInTheDocument();
    });
  });

  it('shows "Unassigned tubes" heading when filtered', async () => {
    renderAt('/tubes?unassigned=true');
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Unassigned tubes' })).toBeInTheDocument();
    });
  });

  it('shows "Unassigned only ✕" chip when filtered', async () => {
    renderAt('/tubes?unassigned=true');
    await waitFor(() => {
      expect(screen.getByText(/Unassigned only/)).toBeInTheDocument();
    });
  });

  it('filters by text search', async () => {
    renderAt('/tubes');
    await waitFor(() => screen.getByText('T001'));
    fireEvent.change(screen.getByPlaceholderText(/filter/i), { target: { value: 'Site A' } });
    expect(screen.getByText('T001')).toBeInTheDocument();
    expect(screen.queryByText('T002')).not.toBeInTheDocument();
  });
});

describe('TubeList — inherited values', () => {
  it('shows site and type inherited from the core, and filters on them', async () => {
    api.getTubes.mockResolvedValueOnce([
      { id: 3, barcode: 'T-INH', box_id: null, site_name: null, sample_type: null,
        core_barcode: 'CR-001', core_site_name: 'North Sea', core_sample_type: 'Piston core' },
      { id: 4, barcode: 'T-OTHER', box_id: null, site_name: 'Lake', sample_type: null },
    ]);
    renderAt('/tubes');
    await waitFor(() => screen.getByText('T-INH'));
    const row = screen.getByText('T-INH').closest('tr');
    expect(within(row).getByText('North Sea')).toBeInTheDocument();
    expect(within(row).getByText('Piston core')).toBeInTheDocument();
    expect(within(row).getAllByText('inherited')).toHaveLength(2);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'north sea' } });
    await waitFor(() => expect(screen.queryByText('T-OTHER')).not.toBeInTheDocument());
    expect(screen.getByText('T-INH')).toBeInTheDocument();
  });
});
