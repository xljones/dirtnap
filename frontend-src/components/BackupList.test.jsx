import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BackupList from './BackupList';
import { api } from '../api.js';

const existing = { name: 'db-backup-20261015_120000.sql', size_bytes: 2048, created_at: '2026-10-15T12:00:00Z' };
const created = { name: 'db-backup-20261016_090000.sql', size_bytes: 4096, created_at: '2026-10-16T09:00:00Z' };

vi.mock('../api.js', () => ({
  api: {
    getBackups: vi.fn(),
    createBackup: vi.fn(),
    backupDownloadUrl: (name) => `/api/admin/backups/${name}`,
  },
}));

vi.mock('./Toast.jsx', () => ({ useToast: () => vi.fn() }));

beforeEach(() => {
  api.getBackups.mockResolvedValue([existing]);
  api.createBackup.mockResolvedValue(created);
});

describe('BackupList', () => {
  it('lists backups with a download link for each', async () => {
    render(<BackupList />);
    expect(await screen.findByText(existing.name)).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Download' });
    expect(link).toHaveAttribute('href', `/api/admin/backups/${existing.name}`);
    expect(link).toHaveAttribute('download', existing.name);
  });

  it('shows an empty state when there are no backups', async () => {
    api.getBackups.mockResolvedValue([]);
    render(<BackupList />);
    expect(await screen.findByText('No backups yet')).toBeInTheDocument();
  });

  it('creates a backup and adds it to the top of the list', async () => {
    render(<BackupList />);
    await screen.findByText(existing.name);
    fireEvent.click(screen.getByRole('button', { name: 'Back up now' }));

    await waitFor(() => expect(api.createBackup).toHaveBeenCalled());
    const links = await screen.findAllByRole('link', { name: 'Download' });
    expect(links.map(a => a.getAttribute('download'))).toEqual([created.name, existing.name]);
  });
});
