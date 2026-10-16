import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MapExportMenu from './MapExportMenu';

vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));

const map = { getSize: () => ({ x: 600, y: 300 }) };

describe('MapExportMenu', () => {
  it('opens a menu with download options', () => {
    render(<MapExportMenu getMap={() => map} points={[]} legend={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Map export options' }));
    expect(screen.getByRole('button', { name: 'Download PNG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download JPEG/ })).toBeInTheDocument();
  });

  it('shows output dimensions for the selected resolution', () => {
    render(<MapExportMenu getMap={() => map} points={[]} legend={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Map export options' }));
    expect(screen.getByText('1200 × 600 px')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '4×' }));
    expect(screen.getByText('2400 × 1200 px')).toBeInTheDocument();
  });
});
