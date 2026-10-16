import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TubeForm from './TubeForm';
import { api } from '../api.js';
import { FormMode } from '../constants.js';

vi.mock('../api.js', () => ({
  api: {
    getBoxes: vi.fn().mockResolvedValue([
      { id: 1, barcode: 'BOX001', name: 'Shelf A' },
      { id: 2, barcode: 'BOX002', name: null },
    ]),
    getCores: vi.fn().mockResolvedValue([]),
    getTube: vi.fn(),
    createTube: vi.fn().mockResolvedValue({ id: 99, barcode: 'TUBE001' }),
    updateTube: vi.fn().mockResolvedValue({ id: 99, barcode: 'TUBE001' }),
    createBox: vi.fn().mockResolvedValue({ id: 3, barcode: 'NEW-BOX', name: null }),
  },
}));

vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));
vi.mock('./MapPicker.jsx', () => ({ default: () => <div data-testid="map-picker" /> }));
vi.mock('./BarcodeInput.jsx', () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={placeholder?.includes('box') ? 'box-barcode-input' : 'tube-barcode-input'}
    />
  ),
}));
vi.mock('./ComboInput.jsx', () => ({
  default: ({ value, onChange, placeholder }) => (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={placeholder?.includes('box') ? 'box-barcode-input' : 'core-barcode-input'}
    />
  ),
}));

function renderNew(path = '/tubes/new') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/tubes/new" element={<TubeForm mode={FormMode.CREATE} />} />
        <Route path="/tubes/:id/edit" element={<TubeForm mode={FormMode.EDIT} />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('TubeForm — box scan mode', () => {
  it('shows box barcode input', async () => {
    renderNew();
    await waitFor(() => {
      expect(screen.getByTestId('box-barcode-input')).toBeInTheDocument();
    });
  });

  it('shows match confirmation for known box barcode', async () => {
    renderNew();
    await waitFor(() => screen.getByTestId('box-barcode-input'));
    fireEvent.change(screen.getByTestId('box-barcode-input'), { target: { value: 'BOX001' } });
    await waitFor(() => {
      expect(screen.getByText(/✓.*BOX001/)).toBeInTheDocument();
    });
  });

  it('shows create button for unknown barcode', async () => {
    renderNew();
    await waitFor(() => screen.getByTestId('box-barcode-input'));
    fireEvent.change(screen.getByTestId('box-barcode-input'), { target: { value: 'UNKNOWN' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create "UNKNOWN"/i })).toBeInTheDocument();
    });
  });

  it('prefills box barcode when box_id query param is provided', async () => {
    renderNew('/tubes/new?box_id=1');
    await waitFor(() => {
      expect(screen.getByTestId('box-barcode-input')).toHaveValue('BOX001');
    });
  });
});

describe('TubeForm — map picker', () => {
  it('map picker is always visible', async () => {
    renderNew();
    await waitFor(() => expect(screen.getByTestId('map-picker')).toBeInTheDocument());
  });
});

describe('TubeForm — create and add another', () => {
  const field = label =>
    screen.getByText(label, { selector: 'label' }).parentElement.querySelector('input, textarea');

  it('is not shown in edit mode', async () => {
    api.getTube.mockResolvedValueOnce({ id: 99, barcode: 'TUBE001' });
    renderNew('/tubes/99/edit');
    await waitFor(() => screen.getByRole('button', { name: /save changes/i }));
    expect(screen.queryByRole('button', { name: /add another/i })).not.toBeInTheDocument();
  });

  it('creates the tube and resets the form, keeping box, core, date, site, type and coordinates', async () => {
    api.createTube.mockClear();
    api.getCores.mockResolvedValueOnce([{ id: 5, barcode: 'CORE005' }]);
    renderNew('/tubes/new?box_id=1&core_id=5');
    await waitFor(() => expect(screen.getByTestId('box-barcode-input')).toHaveValue('BOX001'));
    await waitFor(() => expect(screen.getByTestId('core-barcode-input')).toHaveValue('CORE005'));

    fireEvent.change(screen.getByTestId('tube-barcode-input'), { target: { value: 'TUBE001' } });
    fireEvent.change(field('Sample date'), { target: { value: '2026-10-01' } });
    fireEvent.change(field('Site name'), { target: { value: 'Lake Tahoe' } });
    fireEvent.change(field('Sample type'), { target: { value: 'surface' } });
    fireEvent.change(field('Depth in core (cm)'), { target: { value: '12' } });
    fireEvent.change(field('Description / notes'), { target: { value: 'notes' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. 39.0968'), { target: { value: '39.1' } });
    fireEvent.change(screen.getByPlaceholderText('e.g. -120.0324'), { target: { value: '-120' } });

    fireEvent.click(screen.getByRole('button', { name: /create and add another tube/i }));

    await waitFor(() => expect(api.createTube).toHaveBeenCalledTimes(1));
    expect(api.createTube.mock.calls[0][0]).toMatchObject({ barcode: 'TUBE001', box_id: 1, core_id: 5, depth_cm: 12 });

    await waitFor(() => expect(screen.getByTestId('tube-barcode-input')).toHaveValue(''));
    expect(screen.getByTestId('box-barcode-input')).toHaveValue('BOX001');
    expect(screen.getByTestId('core-barcode-input')).toHaveValue('CORE005');
    expect(field('Sample date')).toHaveValue('2026-10-01');
    expect(field('Site name')).toHaveValue('Lake Tahoe');
    expect(field('Sample type')).toHaveValue('surface');
    expect(field('Depth in core (cm)')).toHaveValue(null);
    expect(field('Description / notes')).toHaveValue('');
    expect(screen.getByRole('heading', { name: 'New tube' })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('tube-barcode-input'), { target: { value: 'TUBE002' } });
    fireEvent.click(screen.getByRole('button', { name: /create and add another tube/i }));
    await waitFor(() => expect(api.createTube).toHaveBeenCalledTimes(2));
    expect(api.createTube.mock.calls[1][0]).toMatchObject({
      barcode: 'TUBE002', box_id: 1, core_id: 5, sample_date: '2026-10-01',
      site_name: 'Lake Tahoe', sample_type: 'surface', latitude: 39.1, longitude: -120.0,
      depth_cm: null, description: '',
    });
  });
});

describe('TubeForm — inherited core values', () => {
  const field = label =>
    screen.getByText(label, { selector: 'label' }).parentElement.querySelector('input, textarea');

  it('shows what an empty field will inherit from the selected core', async () => {
    api.getCores.mockResolvedValueOnce([
      { id: 5, barcode: 'CORE005', site_name: 'North Sea', sample_type: 'Piston core', latitude: 56.82, longitude: 3.1 },
    ]);
    renderNew();
    await waitFor(() => screen.getByTestId('core-barcode-input'));
    expect(screen.queryByText(/inherits from core/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('core-barcode-input'), { target: { value: 'CORE005' } });

    await waitFor(() => expect(screen.getByText('Inherits from core: North Sea')).toBeInTheDocument());
    expect(screen.getByText('Inherits from core: Piston core')).toBeInTheDocument();
    expect(screen.getByText('Inherits from core: 56.82')).toBeInTheDocument();
    expect(screen.getByText('Inherits from core: 3.1')).toBeInTheDocument();

    fireEvent.change(field('Site name'), { target: { value: 'Own site' } });
    expect(screen.queryByText('Inherits from core: North Sea')).not.toBeInTheDocument();
  });

  it('starting from a core page shows inherited values instead of copying them', async () => {
    api.getCores.mockResolvedValueOnce([
      { id: 5, barcode: 'CORE005', site_name: 'North Sea', sample_type: 'Piston core', latitude: 56.82, longitude: 3.1 },
    ]);
    renderNew('/tubes/new?core_id=5');
    await waitFor(() => expect(screen.getByTestId('core-barcode-input')).toHaveValue('CORE005'));

    expect(field('Site name')).toHaveValue('');
    expect(field('Sample type')).toHaveValue('');
    expect(screen.getByPlaceholderText('e.g. 39.0968')).toHaveValue(null);
    expect(screen.getByText('Inherits from core: North Sea')).toBeInTheDocument();
    expect(screen.getByText('Inherits from core: 56.82')).toBeInTheDocument();
  });
});
