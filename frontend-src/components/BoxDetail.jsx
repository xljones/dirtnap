import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from './Toast.jsx';
import RelativeTime from './RelativeTime.jsx';
import BarcodeInput from './BarcodeInput.jsx';
import LeafletMap from './LeafletMap.jsx';
import ExportDropdown from './ExportDropdown.jsx';
import { SkeletonPage } from './Skeleton.jsx';

export default function BoxDetail() {
  const { user } = useAuth();
  const ro = user?.is_readonly;
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [box, setBox] = useState(null);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignBarcode, setAssignBarcode] = useState('');
  const [unassigned, setUnassigned] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(null);
  const [fromCore, setFromCore] = useState(null);
  const [withTubes, setWithTubes] = useState(true);

  useEffect(() => {
    api.getBox(id).then(b => { setBox(b); setForm({ barcode: b.barcode, name: b.name ?? '', location_id: b.location_id ?? '', notes: b.notes ?? '' }); });
    api.getLocations().then(setLocations);
  }, [id]);
  const fromPath = searchParams.get('from') ?? '';
  const fromLocationMatch = fromPath.match(/^\/locations\/(\d+)$/);
  const fromTubeMatch = fromPath.match(/^\/tubes\/(\d+)$/);

  useEffect(() => {
    const match = fromPath.match(/^\/cores\/(\d+)$/);
    if (match) api.getCore(match[1]).then(setFromCore);
  }, [fromPath]);
  useEffect(() => { api.getBoxHistory(id).then(setHistory); }, [id]);

  useEffect(() => {
    if (showAssign && unassigned.length === 0) {
      api.getTubes().then(tubes => setUnassigned(tubes.filter(t => !t.box_id)));
    }
  }, [showAssign, unassigned.length]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const assignMatch = assignBarcode
    ? unassigned.find(t => t.barcode.toLowerCase() === assignBarcode.toLowerCase())
    : null;
  const assignNotFound = assignBarcode.length > 0 && !assignMatch;

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateBox(id, form);
      setBox(b => ({ ...b, ...updated }));
      setEditing(false);
      api.getBoxHistory(id).then(setHistory);
      toast('Box updated');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleEmpty() {
    if (!box.tubes?.length) return;
    if (!confirm(`Unassign all ${box.tubes.length} tube${box.tubes.length !== 1 ? 's' : ''} from this box?`)) return;
    await api.emptyBox(id);
    setBox(b => ({ ...b, tubes: [] }));
    toast('Box emptied');
  }

  async function handleDelete() {
    if (!confirm('Delete this box? Tubes will become unassigned.')) return;
    await api.deleteBox(id);
    toast('Box deleted');
    navigate('/boxes');
  }

  async function handleRemoveTube(tubeId) {
    await api.updateTube(tubeId, { ...box.tubes.find(t => t.id === tubeId), box_id: null });
    setBox(b => ({ ...b, tubes: b.tubes.filter(t => t.id !== tubeId) }));
    setUnassigned(us => [...us, box.tubes.find(t => t.id === tubeId)]);
    toast('Tube removed from box');
  }

  async function handleAssign() {
    if (!assignMatch) return;
    await api.updateTube(assignMatch.id, { ...assignMatch, box_id: Number(id) });
    setBox(b => ({ ...b, tubes: [...(b.tubes ?? []), { ...assignMatch, box_id: Number(id) }] }));
    setUnassigned(us => us.filter(t => t.id !== assignMatch.id));
    setAssignBarcode('');
    toast(`Tube ${assignMatch.barcode} added to box`);
  }

  function toggleHistory() {
    setShowHistory(v => !v);
  }

  async function handleRevert(versionId) {
    if (!confirm('Revert this box to the selected version?')) return;
    const updated = await api.revertBox(id, versionId);
    setBox(b => ({ ...b, ...updated }));
    api.getBoxHistory(id).then(setHistory);
    toast('Box reverted');
  }

  if (!box) return <SkeletonPage />;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="back-link">
            <Link to={fromPath || '/boxes'}>
              {(() => {
                if (fromCore) return `← Core ${fromCore.barcode}${fromCore.name ? ` — ${fromCore.name}` : ''}`;
                if (fromTubeMatch) {
                  const t = box.tubes?.find(t => String(t.id) === fromTubeMatch[1]);
                  return `← Tube ${t?.barcode ?? fromTubeMatch[1]}`;
                }
                if (fromLocationMatch && box.location_name) return `← Storage location — ${box.location_name}`;
                return '← Boxes';
              })()}
            </Link>
          </div>
          <h1 className="page-title">{box.name || <span className="barcode">{box.barcode}</span>}</h1>
        </div>
        <div className="btn-group">
          <ExportDropdown
            label="Export"
            options={[
              { type: 'checkbox', label: 'Include tubes', checked: withTubes, onChange: () => setWithTubes(v => !v) },
              { divider: true },
              { label: 'Comma separated values (.csv)', onClick: () => { window.location.href = withTubes ? `/api/export/boxes/${id}` : `/api/export/boxes/${id}?flat=1`; } },
              { label: 'Tab separated values (.tsv)', onClick: () => { window.location.href = withTubes ? `/api/export/boxes/${id}?format=tsv` : `/api/export/boxes/${id}?flat=1&format=tsv`; } },
              { label: 'JSON (.json)', onClick: () => { window.location.href = withTubes ? `/api/export/boxes/${id}?format=json` : `/api/export/boxes/${id}?flat=1&format=json`; } },
              { label: 'Excel (.xlsx)', note: 'Boxes & tubes', onClick: () => { window.location.href = `/api/export/boxes/${id}?format=xlsx`; } },
            ]}
          />
          {editing && (
            <button type="submit" form="box-edit-form" className="btn btn-success" disabled={saving}>Save Changes</button>
          )}
          {!ro && (
            <button className="btn btn-secondary" onClick={() => setEditing(v => !v)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
          {!ro && <button className="btn btn-danger" onClick={handleDelete}>Delete</button>}
        </div>
      </div>

      <div className="card card-body mb-6">
        <form id="box-edit-form" onSubmit={handleSave}>
          <div className="form-grid">
            <div className="field">
              <label>Barcode *</label>
              {editing
                ? <BarcodeInput value={form.barcode} onChange={v => set('barcode', v)} />
                : <span className="barcode">{box.barcode}</span>}
            </div>
            <div className="field">
              <label>Name</label>
              {editing
                ? <input value={form.name} onChange={e => set('name', e.target.value)} />
                : <span>{box.name || '—'}</span>}
            </div>
            <div className="field">
              <label>Storage location</label>
              {editing ? (
                <select value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                  <option value="">— No storage location —</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <span>{box.location_name || '—'}</span>
              )}
            </div>
            <div className="field">
              <label>Notes</label>
              {editing
                ? <input value={form.notes} onChange={e => set('notes', e.target.value)} />
                : <span>{box.notes || '—'}</span>}
            </div>
            <div className="field">
              <label>Created</label>
              <span><RelativeTime value={box.created_at} /></span>
            </div>
            <div className="field">
              <label>Updated</label>
              <span><RelativeTime value={box.updated_at} /></span>
            </div>
          </div>
        </form>
      </div>

      <div className="section-header">
        <h2 className="section-title">Tubes ({box.tubes?.length ?? 0})</h2>
        <div className="btn-group">
          {!ro && (
            <button className={`btn btn-secondary btn-sm${showAssign ? ' btn-active' : ''}`} onClick={() => setShowAssign(v => !v)}>
              Assign existing
            </button>
          )}
          {!ro && box.tubes?.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleEmpty}>Empty box</button>
          )}
          {!ro && <Link to={`/tubes/new?box_id=${id}`} className="btn btn-primary btn-sm">+ New tube</Link>}
        </div>
      </div>

      {showAssign && (
        <div className="card card-body mb-4">
          <BarcodeInput
            value={assignBarcode}
            onChange={setAssignBarcode}
            placeholder="Scan or type tube barcode to filter…"
            autoFocus
          />
          {assignMatch && (
            <div className="assign-match">
              <span className="text-sm">
                <span className="barcode">{assignMatch.barcode}</span>
                {assignMatch.site_name ? ` — ${assignMatch.site_name}` : ''}
              </span>
              <button className="btn btn-primary btn-sm" onClick={handleAssign}>
                Assign to this box
              </button>
            </div>
          )}
          {assignNotFound && (
            <p className="form-hint muted mt-2">No unassigned tube with that barcode.</p>
          )}
          {!assignMatch && unassigned.length > 0 && (() => {
            const q = assignBarcode.toLowerCase();
            const filtered = q
              ? unassigned.filter(t =>
                  t.barcode.toLowerCase().includes(q) ||
                  (t.site_name ?? '').toLowerCase().includes(q) ||
                  (t.sample_type ?? '').toLowerCase().includes(q)
                )
              : unassigned;
            return filtered.length > 0 ? (
              <div className="mt-3">
                <div className="label-sm mb-2">
                  Unassigned tubes {q ? `(${filtered.length} match${filtered.length !== 1 ? 'es' : ''})` : `(${filtered.length})`}
                </div>
                <div className="scroll-list">
                  <table>
                    <tbody>
                      {filtered.map(t => (
                        <tr
                          key={t.id}
                          className="row-clickable"
                          onClick={async () => {
                            await api.updateTube(t.id, { ...t, box_id: Number(id) });
                            setBox(b => ({ ...b, tubes: [...(b.tubes ?? []), { ...t, box_id: Number(id) }] }));
                            setUnassigned(us => us.filter(u => u.id !== t.id));
                            toast(`Tube ${t.barcode} added to box`);
                          }}
                        >
                          <td><span className="barcode">{t.barcode}</span></td>
                          <td className="text-muted text-sm">{t.site_name || '—'}</td>
                          <td className="text-muted text-sm">{t.sample_type || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null;
          })()}
          {unassigned.length === 0 && !assignBarcode && (
            <p className="form-hint muted mt-2">No unassigned tubes.</p>
          )}
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Barcode</th><th>Site</th><th>Type</th><th>Depth (cm)</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {box.tubes?.map(t => (
                <tr key={t.id} className="row-clickable" onClick={e => { if (!e.target.closest('a, button')) navigate(`/tubes/${t.id}?from=/boxes/${id}`); }}>
                  <td><Link to={`/tubes/${t.id}?from=/boxes/${id}`}><span className="barcode">{t.barcode}</span></Link></td>
                  <td>{t.site_name || '—'}</td>
                  <td>{t.sample_type || '—'}</td>
                  <td>{t.depth_cm ?? '—'}</td>
                  <td>{t.sample_date || '—'}</td>
                  <td className="col-shrink">
                    <div className="row-actions">
                      {!ro && <Link to={`/tubes/${t.id}?edit=1&from=/boxes/${id}`} className="btn btn-secondary btn-sm">Edit</Link>}
                      {!ro && <button className="btn btn-danger btn-sm" onClick={() => handleRemoveTube(t.id)}>Remove</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {(box.tubes?.length ?? 0) === 0 && <tr><td colSpan={6} className="empty">No tubes in this box</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <LeafletMap
        points={(box.tubes ?? [])
          .map(t => ({ ...t, lat: t.latitude ?? t.core_latitude, lng: t.longitude ?? t.core_longitude }))
          .filter(t => t.lat != null && t.lng != null)
          .map(t => ({ lat: t.lat, lng: t.lng, label: t.barcode + (t.site_name ? ` — ${t.site_name}` : ''), url: `/tubes/${t.id}` }))}
        exportName={`${box.barcode}-map`}
      />

      <div className="mt-4">
        <button className="btn btn-secondary btn-sm" onClick={toggleHistory}>
          {showHistory ? '▼' : '▶'} Version history{history ? ` (${history.length})` : ''}
        </button>
        {showHistory && (
          <div className="card mt-2">
            {history === null && <p className="card-message">Loading…</p>}
            {history?.length === 0 && <p className="card-message">No history yet.</p>}
            {history?.map((v, i) => {
              const prev = history[i + 1];
              const diff = (key) => prev && String(v[key] ?? '') !== String(prev[key] ?? '');
              const f = (label, value, key) => (
                <span>
                  <em className={diff(key) ? 'diff' : ''}>{label}</em>{' '}
                  <span className={diff(key) ? 'diff-value' : ''}>{value}</span>
                </span>
              );
              return (
                <div key={v.id} className="history-entry">
                  <div className="history-row">
                    <div>
                      <div className="history-meta">
                        {v.changed_at} — <strong>{v.changed_by_username ?? 'unknown'}</strong>
                      </div>
                      <div className="history-fields">
                        {f('barcode', v.barcode, 'barcode')}
                        {f('name', v.name || '—', 'name')}
                        {f('location', v.location_name || '—', 'location_id')}
                        {f('notes', v.notes || '—', 'notes')}
                      </div>
                    </div>
                    {i > 0 && (
                      <button className="btn btn-secondary btn-sm flex-shrink-0" onClick={() => handleRevert(v.id)}>
                        Revert to this
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
