import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from './Toast.jsx';
import RelativeTime from './RelativeTime.jsx';
import BarcodeInput from './BarcodeInput.jsx';
import CoordCard from './CoordCard.jsx';
import ExportDropdown from './ExportDropdown.jsx';
import { SkeletonPage } from './Skeleton.jsx';
import InheritedValue from './InheritedValue.jsx';

export default function CoreDetail() {
  const { user } = useAuth();
  const ro = user?.is_readonly;
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [core, setCore] = useState(null);
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [history, setHistory] = useState(null);
  const [hoveredTubeId, setHoveredTubeId] = useState(null);
  const [fromTube, setFromTube] = useState(null);
  const [withSubData, setWithSubData] = useState(true);

  useEffect(() => {
    const from = searchParams.get('from') ?? '';
    const match = from.match(/^\/tubes\/(\d+)$/);
    if (match) api.getTube(match[1]).then(setFromTube);
  }, [searchParams]);
  useEffect(() => {
    api.getCore(id).then(c => {
      setCore(c);
      if (searchParams.get('edit') === '1') populateForm(c);
    });
  }, [id, searchParams]);
  useEffect(() => { api.getCoreHistory(id).then(setHistory); }, [id]);
  useEffect(() => { if (editing) api.getLocations().then(setLocations); }, [editing]);

  function populateForm(c) {
    setForm({
      barcode: c.barcode,
      name: c.name ?? '',
      location_id: c.location_id ?? '',
      latitude: c.latitude ?? '',
      longitude: c.longitude ?? '',
      site_name: c.site_name ?? '',
      collection_date: c.collection_date ?? '',
      depth_cm: c.depth_cm ?? '',
      collector: c.collector ?? '',
      sample_type: c.sample_type ?? '',
      owner: c.owner ?? '',
      notes: c.notes ?? '',
    });
  }

  function startEditing() {
    populateForm(core);
        setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
      }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const num = v => v === '' ? null : Number(v);
      const body = {
        ...form,
        location_id: form.location_id === '' ? null : Number(form.location_id),
        latitude: num(form.latitude),
        longitude: num(form.longitude),
        depth_cm: num(form.depth_cm),
      };
      const updated = await api.updateCore(id, body);
      setCore(c => ({ ...c, ...updated }));
      setEditing(false);
            api.getCoreHistory(id).then(setHistory);
      toast('Core updated');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete core ${core.barcode}? Tubes linked to this core will be unlinked.`)) return;
    await api.deleteCore(id);
    toast('Core deleted');
    navigate('/cores');
  }

  async function handleRevert(versionId) {
    if (!confirm('Revert this core to the selected version?')) return;
    const updated = await api.revertCore(id, versionId);
    setCore(c => ({ ...c, ...updated }));
    api.getCoreHistory(id).then(setHistory);
    toast('Core reverted');
  }

  if (!core) return <SkeletonPage />;

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="back-link"><Link to={searchParams.get('from') ?? '/cores'}>← {fromTube ? `Tube ${fromTube.barcode}` : 'Cores'}</Link></div>
          <h1 className="page-title">
            <span className="barcode barcode-lg">{core.barcode}</span>
            {core.name && <span className="text-muted text-base fw-400"> — {core.name}</span>}
          </h1>
        </div>
        <div className="btn-group">
          <ExportDropdown
            label="Export"
            options={[
              { type: 'checkbox', label: 'Include boxes & tubes', checked: withSubData, onChange: () => setWithSubData(v => !v) },
              { divider: true },
              { label: 'Comma separated values (.csv)', onClick: () => { window.location.href = withSubData ? `/api/export/cores/${id}` : `/api/export/cores/${id}?flat=1`; } },
              { label: 'Tab separated values (.tsv)', onClick: () => { window.location.href = withSubData ? `/api/export/cores/${id}?format=tsv` : `/api/export/cores/${id}?flat=1&format=tsv`; } },
              { label: 'JSON (.json)', onClick: () => { window.location.href = withSubData ? `/api/export/cores/${id}?format=json` : `/api/export/cores/${id}?flat=1&format=json`; } },
              { label: 'GeoJSON (.geojson)', note: 'Core location only — sub-data not included', onClick: () => { window.location.href = `/api/export/cores/${id}?flat=1&format=geojson`; } },
              { label: 'Excel (.xlsx)', note: 'Cores, boxes & tubes', onClick: () => { window.location.href = `/api/export/cores/${id}?format=xlsx`; } },
            ]}
          />
          {editing && (
            <button type="submit" form="core-edit-form" className="btn btn-success" disabled={saving || !form.barcode}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
          {!ro && (
            <button className="btn btn-secondary" onClick={editing ? cancelEditing : startEditing}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
          {!ro && <button className="btn btn-danger" onClick={handleDelete}>Delete</button>}
        </div>
      </div>

      <div className="card card-body mb-4">
        <form id="core-edit-form" onSubmit={handleSave}>
          <div className={editing ? 'form-grid mb-3' : 'form-grid'}>

            <div className="field span-2">
              <label>Barcode *</label>
              {editing
                ? <BarcodeInput value={form.barcode} onChange={v => set('barcode', v)} />
                : <span className="barcode">{core.barcode}</span>}
            </div>

            <div className="field">
              <label>Name</label>
              {editing
                ? <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. North Sea Core A" />
                : <span>{core.name || '—'}</span>}
            </div>

            <div className="field">
              <label>Storage location</label>
              {editing
                ? (
                  <select value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                    <option value="">— None —</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )
                : <span>{core.location_name || '—'}</span>}
            </div>

            <div className="field">
              <label>Site name</label>
              {editing
                ? <input value={form.site_name} onChange={e => set('site_name', e.target.value)} placeholder="e.g. North Sea Block 49/5" />
                : <span>{core.site_name || '—'}</span>}
            </div>

            <div className="field">
              <label>Collection date</label>
              {editing
                ? <input type="date" value={form.collection_date} onChange={e => set('collection_date', e.target.value)} />
                : <span>{core.collection_date || '—'}</span>}
            </div>

            <div className="field">
              <label>Total depth (cm)</label>
              {editing
                ? <input type="number" step="any" value={form.depth_cm} onChange={e => set('depth_cm', e.target.value)} placeholder="e.g. 300" />
                : <span>{core.depth_cm != null ? `${core.depth_cm} cm` : '—'}</span>}
            </div>

            <div className="field">
              <label>Sample type</label>
              {editing
                ? <input value={form.sample_type} onChange={e => set('sample_type', e.target.value)} placeholder="e.g. piston core, gravity core…" />
                : <span>{core.sample_type || '—'}</span>}
            </div>

            <div className="field">
              <label>Collector</label>
              {editing
                ? <input value={form.collector} onChange={e => set('collector', e.target.value)} placeholder="Name or vessel" />
                : <span>{core.collector || '—'}</span>}
            </div>

            <div className="field">
              <label>Owner</label>
              {editing
                ? <input value={form.owner} onChange={e => set('owner', e.target.value)} />
                : <span>{core.owner || '—'}</span>}
            </div>

            <div className="field span-2">
              <label>Notes</label>
              {editing
                ? <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
                : <span className="pre-wrap">{core.notes || '—'}</span>}
            </div>

            <div className="field">
              <label>Created</label>
              <span><RelativeTime value={core.created_at} /></span>
            </div>

            <div className="field">
              <label>Updated</label>
              <span><RelativeTime value={core.updated_at} /></span>
            </div>

          </div>
        </form>
      </div>



      <CoordCard
        editing={editing}
        lat={editing ? form.latitude : core.latitude}
        lng={editing ? form.longitude : core.longitude}
        onChange={(lat, lng) => { set('latitude', lat); set('longitude', lng); }}
        mapLabel={core.barcode}
        extraPoints={editing ? [] : (core.tubes ?? [])
          .filter(t => t.latitude != null && t.longitude != null)
          .map(t => ({ lat: t.latitude, lng: t.longitude, label: t.barcode, url: `/tubes/${t.id}`, color: '#22c55e' }))
        }
      />

      <div className="section-header mt-4">
        <h2 className="section-title">Tubes ({core.tubes?.length ?? 0})</h2>
        {!ro && <Link to={`/tubes/new?core_id=${id}`} className="btn btn-primary btn-sm">+ New tube</Link>}
      </div>

      {core.depth_cm != null && core.tubes?.some(t => t.depth_cm != null) && (
        <div className="card card-body mb-2">
          <div className="core-depth-ends">
            <span>Top (0 cm)</span>
            <span>Bottom ({core.depth_cm} cm)</span>
          </div>
          <div className="core-depth-track">
            {core.tubes
              .filter(t => t.depth_cm != null)
              .map(t => (
                <Link
                  key={t.id}
                  to={`/tubes/${t.id}?from=/cores/${id}`}
                  className={`core-depth-marker${hoveredTubeId === t.id ? ' core-depth-marker--active' : ''}`}
                  style={{ left: `${Math.min(100, (t.depth_cm / core.depth_cm) * 100)}%` }}
                  data-tooltip={`${t.barcode} — ${t.depth_cm} cm`}
                  onMouseEnter={() => setHoveredTubeId(t.id)}
                  onMouseLeave={() => setHoveredTubeId(null)}
                />
              ))
            }
          </div>
        </div>
      )}

      {(core.tubes?.length ?? 0) === 0 && (
        <div className="card"><p className="card-message">No tubes linked to this core</p></div>
      )}

      {(() => {
        const tubes = core.tubes ?? [];
        const toggle = key => setCollapsedGroups(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
        const tubeRows = group => group.map(t => (
          <tr
            key={t.id}
            className={`row-clickable${hoveredTubeId === t.id ? ' row-selected' : ''}`}
            onClick={e => { if (!e.target.closest('a, button')) navigate(`/tubes/${t.id}?from=/cores/${id}`); }}
            onMouseEnter={() => setHoveredTubeId(t.id)}
            onMouseLeave={() => setHoveredTubeId(null)}
          >
            <td><Link to={`/tubes/${t.id}?from=/cores/${id}`}><span className="barcode">{t.barcode}</span></Link></td>
            <td><InheritedValue own={t.site_name} inherited={core.site_name} from="Inherited from this core" /></td>
            <td><InheritedValue own={t.sample_type} inherited={core.sample_type} from="Inherited from this core" /></td>
            <td>{t.depth_cm ?? '—'}</td>
            <td>{t.sample_date || '—'}</td>
            <td><div className="row-actions">{!ro && <Link to={`/tubes/${t.id}?edit=1&from=/cores/${id}`} className="btn btn-secondary btn-sm">Edit</Link>}</div></td>
          </tr>
        ));

        const boxMap = {};
        tubes.filter(t => t.box_id != null).forEach(t => {
          if (!boxMap[t.box_id]) boxMap[t.box_id] = { id: t.box_id, barcode: t.box_barcode, name: t.box_name, tubes: [] };
          boxMap[t.box_id].tubes.push(t);
        });
        const boxes = Object.values(boxMap);
        const unallocated = tubes.filter(t => t.box_id == null);

        return (
          <>
            {boxes.map(box => {
              const collapsed = collapsedGroups.has(box.id);
              return (
                <div key={box.id} className="card mb-2">
                  <div className={`card-group-header${collapsed ? ' collapsed' : ''}`} onClick={() => toggle(box.id)}>
                    <span className="toggle">{collapsed ? '▶' : '▼'}</span>
                    <Link to={`/boxes/${box.id}?from=/cores/${id}`} onClick={e => e.stopPropagation()}><span className="barcode">{box.barcode}</span></Link>
                    {box.name && <span className="text-muted">{box.name}</span>}
                    <span className="text-muted" style={{ marginLeft: 'auto', fontWeight: 400 }}>{box.tubes.length} tube{box.tubes.length !== 1 ? 's' : ''}</span>
                  </div>
                  {!collapsed && (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Barcode</th><th>Site</th><th>Type</th><th>Depth (cm)</th><th>Date</th><th></th></tr></thead>
                        <tbody>{tubeRows(box.tubes)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {unallocated.length > 0 && (() => {
              const collapsed = collapsedGroups.has('unallocated');
              return (
                <div className="card mb-2">
                  <div className={`card-group-header${collapsed ? ' collapsed' : ''}`} onClick={() => toggle('unallocated')}>
                    <span className="toggle">{collapsed ? '▶' : '▼'}</span>
                    <span>Unallocated</span>
                    <span className="text-muted" style={{ marginLeft: 'auto', fontWeight: 400 }}>{unallocated.length} tube{unallocated.length !== 1 ? 's' : ''}</span>
                  </div>
                  {!collapsed && (
                    <div className="table-wrap">
                      <table>
                        <thead><tr><th>Barcode</th><th>Site</th><th>Type</th><th>Depth (cm)</th><th>Date</th><th></th></tr></thead>
                        <tbody>{tubeRows(unallocated)}</tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        );
      })()}

      <div className="mt-4">
        <button className="btn btn-secondary btn-sm" onClick={() => setShowHistory(v => !v)}>
          {showHistory ? '▼' : '▶'} Version history{history ? ` (${history.length})` : ''}
        </button>
        {showHistory && (
          <div className="card mt-2">
            {history === null && <p className="card-message">Loading…</p>}
            {history?.length === 0 && <p className="card-message">No history yet.</p>}
            {history?.map((v, i) => {
              const prev = history[i + 1];
              const diff = key => prev && String(v[key] ?? '') !== String(prev[key] ?? '');
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
                        {f('storage', v.location_name || '—', 'location_id')}
                        {f('site', v.site_name || '—', 'site_name')}
                        {f('lat', v.latitude ?? '—', 'latitude')}
                        {f('lng', v.longitude ?? '—', 'longitude')}
                        {f('collected', v.collection_date || '—', 'collection_date')}
                        {f('depth', v.depth_cm != null ? `${v.depth_cm} cm` : '—', 'depth_cm')}
                        {f('type', v.sample_type || '—', 'sample_type')}
                        {f('collector', v.collector || '—', 'collector')}
                        {f('owner', v.owner || '—', 'owner')}
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
