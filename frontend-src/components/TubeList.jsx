import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from './Toast.jsx';
import ComboInput from './ComboInput.jsx';
import ExportDropdown from './ExportDropdown.jsx';
import { SkeletonRows } from './Skeleton.jsx';
import InheritedValue, { coreLabel } from './InheritedValue.jsx';

const TUBE_EXPORT_FIELDS = [
  'barcode', 'box_barcode', 'box_name', 'sample_date', 'site_name',
  'latitude', 'longitude', 'sample_type', 'description', 'volume_ml',
  'weight_g', 'depth_cm', 'created_at', 'updated_at',
];

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const ts = new Date().toISOString().replace(/\.\d+Z$/, '').replace(/:/g, '-');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.replace('{ts}', ts);
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportTubesToCsv(rows) {
  const escape = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    TUBE_EXPORT_FIELDS.join(','),
    ...rows.map(r => TUBE_EXPORT_FIELDS.map(f => escape(r[f])).join(',')),
  ];
  downloadBlob(lines.join('\r\n'), 'tubes-{ts}.csv', 'text/csv');
}

function exportTubesToTsv(rows) {
  const escape = v => v == null ? '' : String(v).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
  const lines = [
    TUBE_EXPORT_FIELDS.join('\t'),
    ...rows.map(r => TUBE_EXPORT_FIELDS.map(f => escape(r[f])).join('\t')),
  ];
  downloadBlob(lines.join('\r\n'), 'tubes-{ts}.tsv', 'text/tab-separated-values');
}

function exportTubesToJson(rows) {
  const out = rows.map(r => Object.fromEntries(TUBE_EXPORT_FIELDS.map(f => [f, r[f] ?? null])));
  downloadBlob(JSON.stringify(out, null, 2), 'tubes-{ts}.json', 'application/json');
}

function exportTubesToGeoJson(rows) {
  const features = rows
    .filter(r => r.latitude != null && r.longitude != null)
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: Object.fromEntries(
        TUBE_EXPORT_FIELDS.filter(f => f !== 'latitude' && f !== 'longitude').map(f => [f, r[f] ?? null])
      ),
    }));
  downloadBlob(JSON.stringify({ type: 'FeatureCollection', features }, null, 2), 'tubes-{ts}.geojson', 'application/geo+json');
}

export default function TubeList() {
  const { user } = useAuth();
  const ro = user?.is_readonly;
  const [tubes, setTubes] = useState(null);
  const [filter, setFilter] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [selected, setSelected] = useState(new Set());
  const [boxes, setBoxes] = useState([]);
  const [assignBarcode, setAssignBarcode] = useState('');
  const [assigning, setAssigning] = useState(false);

  const navigate = useNavigate();
  const unassignedOnly = searchParams.get('unassigned') === 'true';

  useEffect(() => { api.getTubes().then(setTubes); }, []);
  useEffect(() => { api.getBoxes().then(setBoxes); }, []);

  const q = filter.toLowerCase();
  const anyFilter = !!q || unassignedOnly;
  const visible = (tubes ?? [])
    .filter(t => !unassignedOnly || !t.box_id)
    .filter(t => !q || (
      t.barcode.toLowerCase().includes(q) ||
      (t.site_name || t.core_site_name || '').toLowerCase().includes(q) ||
      (t.sample_type || t.core_sample_type || '').toLowerCase().includes(q) ||
      (t.box_barcode ?? '').toLowerCase().includes(q) ||
      (t.box_name ?? '').toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q) ||
      (t.sample_date ?? '').toLowerCase().includes(q) ||
      (t.volume_ml != null ? String(t.volume_ml) : '').includes(q) ||
      (t.weight_g != null ? String(t.weight_g) : '').includes(q) ||
      (t.depth_cm != null ? String(t.depth_cm) : '').includes(q) ||
      (t.latitude != null ? String(t.latitude) : '').includes(q) ||
      (t.longitude != null ? String(t.longitude) : '').includes(q)
    ));

  const allVisibleSelected = visible.length > 0 && visible.every(t => selected.has(t.id));

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected(s => { const n = new Set(s); visible.forEach(t => n.delete(t.id)); return n; });
    } else {
      setSelected(s => { const n = new Set(s); visible.forEach(t => n.add(t.id)); return n; });
    }
  }

  function toggleOne(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const boxMatch = assignBarcode ? boxes.find(b => b.barcode.toLowerCase() === assignBarcode.toLowerCase()) : null;

  async function handleBulkAssign() {
    if (!boxMatch) return;
    setAssigning(true);
    try {
      const ids = [...selected];
      await api.bulkAssignTubes(ids, boxMatch.id);
      setTubes(ts => ts.map(t => selected.has(t.id)
        ? { ...t, box_id: boxMatch.id, box_barcode: boxMatch.barcode, box_name: boxMatch.name, box_location_name: boxMatch.location_name }
        : t
      ));
      toast(`${ids.length} tube${ids.length !== 1 ? 's' : ''} assigned to ${boxMatch.barcode}`);
      setSelected(new Set());
      setAssignBarcode('');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{unassignedOnly ? 'Unassigned tubes' : 'Tubes'}</h1>
        <div className="btn-group">
          <ExportDropdown
            label={anyFilter ? `Export (${visible.length} rows)` : 'Export'}
            disabled={visible.length === 0}
            options={[
              { label: 'Comma separated values (.csv)', onClick: () => { if (anyFilter) exportTubesToCsv(visible); else window.location.href = '/api/export/tubes'; } },
              { label: 'Tab separated values (.tsv)', onClick: () => { if (anyFilter) exportTubesToTsv(visible); else window.location.href = '/api/export/tubes?format=tsv'; } },
              { label: 'JSON (.json)', onClick: () => { if (anyFilter) exportTubesToJson(visible); else window.location.href = '/api/export/tubes?format=json'; } },
              { label: 'GeoJSON (.geojson)', onClick: () => { if (anyFilter) exportTubesToGeoJson(visible); else window.location.href = '/api/export/tubes?format=geojson'; } },
              { label: 'Excel (.xlsx)', onClick: () => { window.location.href = anyFilter ? `/api/export/tubes?format=xlsx&ids=${visible.map(t => t.id).join(',')}` : '/api/export/tubes?format=xlsx'; } },
            ]}
          />
          {!ro && <Link to="/tubes/new" className="btn btn-primary">+ New tube</Link>}
        </div>
      </div>

      <div className="filter-bar">
        <input
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by barcode, site, type…"
          className="search-input"
        />
        {unassignedOnly && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSearchParams({})}
          >
            Unassigned only ✕
          </button>
        )}
      </div>

      {selected.size > 0 && !ro && (
        <div className="card card-body mb-4 assign-bar">
          <span className="text-sm fw-600">{selected.size} tube{selected.size !== 1 ? 's' : ''} selected</span>
          <div className="assign-input-group">
            <ComboInput
              value={assignBarcode}
              onChange={setAssignBarcode}
              options={boxes}
              placeholder="Scan or type box barcode…"
            />
            {assignBarcode && !boxMatch && (
              <span className="meta">Box not found</span>
            )}
            {boxMatch && (
              <button className="btn btn-success btn-sm flex-shrink-0" onClick={handleBulkAssign} disabled={assigning}>
                {assigning ? 'Assigning…' : `Assign to ${boxMatch.barcode}`}
              </button>
            )}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => { setSelected(new Set()); setAssignBarcode(''); }}>
            Clear selection
          </button>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {!ro && (
                  <th className="col-checkbox">
                    <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} />
                  </th>
                )}
                <th>Barcode</th><th>Box</th><th>Site</th><th>Type</th>
                <th className="col-mobile-hide">Depth (cm)</th><th className="col-mobile-hide">Sample date</th><th></th>
              </tr>
            </thead>
            <tbody>
              {tubes === null
                ? <SkeletonRows cols={['90px', '80px', '35%', '25%', '50px', '90px', null]} />
                : <>
                    {visible.map(t => (
                      <tr
                        key={t.id}
                        className={`row-clickable${selected.has(t.id) ? ' row-selected' : ''}`}
                        onClick={e => { if (!e.target.closest('a, button, input')) navigate(`/tubes/${t.id}`); }}
                      >
                        {!ro && (
                          <td className="col-checkbox" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} />
                          </td>
                        )}
                        <td><Link to={`/tubes/${t.id}`}><span className="barcode">{t.barcode}</span></Link></td>
                        <td>{t.box_barcode ? <Link to={`/boxes/${t.box_id}`}><span className="barcode">{t.box_barcode}</span></Link> : <span className="text-muted">—</span>}</td>
                        <td><InheritedValue own={t.site_name} inherited={t.core_site_name} from={coreLabel(t)} /></td>
                        <td><InheritedValue own={t.sample_type} inherited={t.core_sample_type} from={coreLabel(t)} /></td>
                        <td className="col-mobile-hide">{t.depth_cm ?? '—'}</td>
                        <td className="col-mobile-hide">{t.sample_date || '—'}</td>
                        <td className="col-shrink">
                          <div className="row-actions">
                            {!ro && <Link to={`/tubes/${t.id}?edit=1`} className="btn btn-secondary btn-sm">Edit</Link>}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {visible.length === 0 && <tr><td colSpan={ro ? 7 : 8} className="empty">{filter ? 'No matches' : 'No tubes yet'}</td></tr>}
                  </>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
