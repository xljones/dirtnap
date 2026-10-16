import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BoxDetail from './BoxDetail';
import { api } from '../api.js';

const mockUpdateTube = vi.hoisted(() => vi.fn().mockResolvedValue({ id: 20, barcode: 'T002', box_id: 1 }));

vi.mock('../api.js', () => ({
  api: {
    getBox: vi.fn().mockResolvedValue({
      id: 1,
      barcode: 'BOX001',
      name: 'Shelf A',
      location_name: 'Freezer 2',
      notes: '',
      created_at: '2024-01-01T00:00:00',
      tubes: [
        { id: 10, barcode: 'T001', site_name: 'River', sample_type: 'core', depth_cm: 5, sample_date: '2024-01-01', box_id: 1, latitude: null, longitude: null },
      ],
    }),
    getTubes: vi.fn().mockResolvedValue([
      { id: 10, barcode: 'T001', box_id: 1, site_name: 'River', sample_type: 'core', depth_cm: 5, sample_date: '2024-01-01', latitude: null, longitude: null },
      { id: 20, barcode: 'T002', box_id: null, site_name: 'Lake', sample_type: null, depth_cm: null, sample_date: null, latitude: null, longitude: null },
      { id: 21, barcode: 'T003', box_id: null, site_name: null, sample_type: null, depth_cm: null, sample_date: null, latitude: null, longitude: null },
    ]),
    updateBox: vi.fn().mockResolvedValue({ id: 1, barcode: 'BOX001', name: 'Shelf A' }),
    deleteBox: vi.fn().mockResolvedValue(null),
    getLocations: vi.fn().mockResolvedValue([]),
    getBoxHistory: vi.fn().mockResolvedValue([]),
    emptyBox: vi.fn().mockResolvedValue(null),
    revertBox: vi.fn().mockResolvedValue({ id: 1, barcode: 'BOX001', name: 'Shelf A' }),
    updateTube: mockUpdateTube,
  },
}));

vi.mock('../AuthContext.jsx', () => ({ useAuth: () => ({ user: { is_readonly: false } }) }));
vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));
vi.mock('./LeafletMap.jsx', () => ({ default: () => null }));
vi.mock('./BarcodeInput.jsx', () => ({
  default: ({ value, onChange, placeholder, autoFocus }) => (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      data-testid="barcode-input"
    />
  ),
}));

function renderBoxDetail() {
  return render(
    <MemoryRouter initialEntries={['/boxes/1']}>
      <Routes><Route path="/boxes/:id" element={<BoxDetail />} /></Routes>
    </MemoryRouter>
  );
}

describe('BoxDetail', () => {
  it('renders box name and location', async () => {
    renderBoxDetail();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Shelf A' })).toBeInTheDocument();
      expect(screen.getByText('Freezer 2')).toBeInTheDocument();
    });
  });

  it('renders tube row with barcode link, Edit and Remove buttons', async () => {
    renderBoxDetail();
    await waitFor(() => screen.getByText('T001'));
    expect(screen.getByRole('link', { name: 'T001' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/tubes/10?edit=1&from=/boxes/1');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
  });

  it('opens assign panel when "Assign existing" is clicked', async () => {
    renderBoxDetail();
    await waitFor(() => screen.getByText('T001'));
    fireEvent.click(screen.getByRole('button', { name: /assign existing/i }));
    await waitFor(() => {
      expect(screen.getByTestId('barcode-input')).toBeInTheDocument();
    });
  });

  it('shows unassigned tubes in the list', async () => {
    renderBoxDetail();
    await waitFor(() => screen.getByText('T001'));
    fireEvent.click(screen.getByRole('button', { name: /assign existing/i }));
    await waitFor(() => {
      expect(screen.getByText('T002')).toBeInTheDocument();
      expect(screen.getByText('T003')).toBeInTheDocument();
    });
  });

  it('clicking a tube in the list assigns it directly', async () => {
    renderBoxDetail();
    await waitFor(() => screen.getByText('T001'));
    fireEvent.click(screen.getByRole('button', { name: /assign existing/i }));
    await waitFor(() => screen.getByText('T002'));
    fireEvent.click(screen.getByText('T002').closest('tr'));
    await waitFor(() => expect(mockUpdateTube).toHaveBeenCalledWith(20, expect.objectContaining({ box_id: 1 })));
  });

  it('shows "Assign to this box" button when barcode matches unassigned tube', async () => {
    renderBoxDetail();
    await waitFor(() => screen.getByText('T001'));
    fireEvent.click(screen.getByRole('button', { name: /assign existing/i }));
    await waitFor(() => screen.getByTestId('barcode-input'));
    fireEvent.change(screen.getByTestId('barcode-input'), { target: { value: 'T002' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /assign to this box/i })).toBeInTheDocument();
    });
  });

  it('calls updateTube with box_id when assigning', async () => {
    renderBoxDetail();
    await waitFor(() => screen.getByText('T001'));
    fireEvent.click(screen.getByRole('button', { name: /assign existing/i }));
    await waitFor(() => screen.getByTestId('barcode-input'));
    fireEvent.change(screen.getByTestId('barcode-input'), { target: { value: 'T002' } });
    await waitFor(() => screen.getByRole('button', { name: /assign to this box/i }));
    fireEvent.click(screen.getByRole('button', { name: /assign to this box/i }));
    await waitFor(() => expect(mockUpdateTube).toHaveBeenCalledWith(20, expect.objectContaining({ box_id: 1 })));
  });

  it('filters the unassigned list by typed barcode', async () => {
    renderBoxDetail();
    await waitFor(() => screen.getByText('T001'));
    fireEvent.click(screen.getByRole('button', { name: /assign existing/i }));
    await waitFor(() => screen.getByText('T002'));
    fireEvent.change(screen.getByTestId('barcode-input'), { target: { value: 'T002' } });
    await waitFor(() => {
      expect(screen.queryByText('T003')).not.toBeInTheDocument();
    });
  });
});

describe('BoxDetail — inherited values', () => {
  it('shows site and type a tube inherits from its core', async () => {
    api.getBox.mockResolvedValueOnce({
      id: 1, barcode: 'BOX001', name: 'Shelf A', notes: '', created_at: '2024-01-01T00:00:00',
      tubes: [{ id: 12, barcode: 'T-INH', site_name: null, sample_type: null, box_id: 1,
        core_barcode: 'CR-001', core_site_name: 'North Sea', core_sample_type: 'Piston core' }],
    });
    renderBoxDetail();
    await waitFor(() => screen.getByText('T-INH'));
    const row = screen.getByText('T-INH').closest('tr');
    expect(within(row).getByText('North Sea')).toBeInTheDocument();
    expect(within(row).getByText('Piston core')).toBeInTheDocument();
    expect(within(row).getAllByText('inherited')).toHaveLength(2);
  });
});
