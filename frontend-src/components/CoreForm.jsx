import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from './Toast.jsx';
import BarcodeInput from './BarcodeInput.jsx';
import CoordCard from './CoordCard.jsx';
import CreateButtons from './CreateButtons.jsx';

const EMPTY = {
  barcode: '', name: '', location_id: '', site_name: '', collection_date: '',
  depth_cm: '', sample_type: '', collector: '', owner: '', notes: '',
  latitude: '', longitude: '',
};

// Fields carried over when using "+ add another"
const KEEP_ON_ADD_ANOTHER = [
  'location_id', 'site_name', 'collection_date', 'sample_type', 'collector', 'owner', 'latitude', 'longitude',
];

export default function CoreForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY, barcode: params.get('barcode') ?? '' });
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const addAnotherRef = useRef(false);

  useEffect(() => { api.getLocations().then(setLocations); }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const num = v => v === '' ? null : Number(v);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {
        ...form,
        location_id: form.location_id === '' ? null : Number(form.location_id),
        latitude: num(form.latitude),
        longitude: num(form.longitude),
        depth_cm: num(form.depth_cm),
      };
      const core = await api.createCore(body);
      toast(`Core ${core.barcode} created`);
      if (addAnotherRef.current) {
        setForm(f => ({
          ...EMPTY,
          ...Object.fromEntries(KEEP_ON_ADD_ANOTHER.map(k => [k, f[k]])),
        }));
        setResetCount(c => c + 1);
      } else {
        navigate(`/cores/${core.id}`);
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="back-link"><Link to="/cores">← Cores</Link></div>
          <h1 className="page-title">New core</h1>
        </div>
      </div>

      <div className="card card-body">
        <form onSubmit={handleSubmit}>
          <div className="form-grid mb-4">
            <div className="field span-2">
              <label>Barcode *</label>
              <BarcodeInput
                key={resetCount}
                value={form.barcode}
                onChange={v => set('barcode', v)}
                placeholder="Scan or type core barcode"
                autoFocus
              />
            </div>

            <div className="field">
              <label>Name</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. North Sea Core A" />
            </div>

            <div className="field">
              <label>Storage location</label>
              <select value={form.location_id} onChange={e => set('location_id', e.target.value)}>
                <option value="">— None —</option>
                {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <div className="field">
              <label>Site name</label>
              <input value={form.site_name} onChange={e => set('site_name', e.target.value)} placeholder="e.g. North Sea Block 49/5" />
            </div>

            <div className="field">
              <label>Collection date</label>
              <input type="date" value={form.collection_date} onChange={e => set('collection_date', e.target.value)} />
            </div>

            <div className="field">
              <label>Total depth (cm)</label>
              <input type="number" step="any" value={form.depth_cm} onChange={e => set('depth_cm', e.target.value)} placeholder="e.g. 300" />
            </div>

            <div className="field">
              <label>Sample type</label>
              <input value={form.sample_type} onChange={e => set('sample_type', e.target.value)} placeholder="e.g. piston core, gravity core…" />
            </div>

            <div className="field">
              <label>Collector</label>
              <input value={form.collector} onChange={e => set('collector', e.target.value)} placeholder="Name or vessel" />
            </div>

            <div className="field">
              <label>Owner</label>
              <input value={form.owner} onChange={e => set('owner', e.target.value)} />
            </div>

            <div className="field span-2">
              <label>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes…" />
            </div>
          </div>

          <div className="form-actions">
            <CreateButtons label="Create core" saving={saving} disabled={!form.barcode} addAnotherRef={addAnotherRef} />
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/cores')}>Cancel</button>
          </div>
        </form>
      </div>

      <CoordCard
        editing
        lat={form.latitude}
        lng={form.longitude}
        onChange={(lat, lng) => { set('latitude', lat); set('longitude', lng); }}
      />
    </div>
  );
}
