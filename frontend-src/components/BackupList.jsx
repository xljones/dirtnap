import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import RelativeTime from './RelativeTime.jsx';

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupList() {
  const [backups, setBackups] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.getBackups()
      .then(setBackups)
      .catch(err => setError(err.message));
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const created = await api.createBackup();
      setBackups(bs => [created, ...(bs ?? []).filter(b => b.name !== created.name)]);
      toast(`Backup "${created.name}" created`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Backups</h1>
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Backing up…' : 'Back up now'}
        </button>
      </div>

      <div className="card mb-6">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>File</th><th>Size</th><th>Created</th><th></th></tr>
            </thead>
            <tbody>
              {error && <tr><td colSpan={4} className="empty text-danger">{error}</td></tr>}
              {!error && backups === null && <tr><td colSpan={4} className="empty">Loading…</td></tr>}
              {backups?.map(b => (
                <tr key={b.name}>
                  <td className="text-sm" style={{ fontFamily: 'monospace' }}>{b.name}</td>
                  <td className="text-muted text-sm">{formatBytes(b.size_bytes)}</td>
                  <td className="meta"><RelativeTime value={b.created_at} /></td>
                  <td className="col-shrink">
                    <a className="btn btn-secondary btn-sm" href={api.backupDownloadUrl(b.name)} download={b.name}>
                      Download
                    </a>
                  </td>
                </tr>
              ))}
              {backups?.length === 0 && <tr><td colSpan={4} className="empty">No backups yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
