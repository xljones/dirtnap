import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import { useToast } from './Toast.jsx';
import { SkeletonRows } from './Skeleton.jsx';
import CreateButtons from './CreateButtons.jsx';

export default function LocationList() {
  const { user } = useAuth();
  const ro = user?.is_readonly;
  const [locations, setLocations] = useState(null);
  const [filter, setFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  const addAnotherRef = useRef(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => { api.getLocations().then(setLocations); }, []);

  const q = filter.toLowerCase();
  const visible = locations ? (q ? locations.filter(l => l.name.toLowerCase().includes(q)) : locations) : [];

  async function handleAdd(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const loc = await api.createLocation({ name: newName.trim() });
      setLocations(ls => [...ls, loc].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      if (addAnotherRef.current) setResetCount(c => c + 1);
      else setShowAdd(false);
      toast(`Location ${loc.name} created`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(loc) {
    setEditId(loc.id);
    setEditName(loc.name);
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateLocation(editId, { name: editName.trim() });
      setLocations(ls => ls.map(l => l.id === editId ? { ...l, ...updated } : l).sort((a, b) => a.name.localeCompare(b.name)));
      setEditId(null);
      toast('Location renamed');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(loc) {
    if (!confirm(`Delete location "${loc.name}"?`)) return;
    try {
      await api.deleteLocation(loc.id);
      setLocations(ls => ls.filter(l => l.id !== loc.id));
      toast('Location deleted');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Storage locations</h1>
        {!ro && <button className="btn btn-primary" onClick={() => setShowAdd(v => !v)}>+ New storage location</button>}
      </div>

      {showAdd && (
        <div className="card card-body mb-6">
          <form onSubmit={handleAdd} className="inline-form">
            <input
              key={resetCount}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Storage location name, e.g. Oslo – Cold Store"
              autoFocus
              className="barcode-input"
            />
            <CreateButtons label="Save" saving={saving} disabled={!newName.trim()} addAnotherRef={addAnotherRef} />
            <button type="button" className="btn btn-secondary" onClick={() => { setShowAdd(false); setNewName(''); }}>Cancel</button>
          </form>
        </div>
      )}

      <div className="mb-4">
        <input
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filter by name…"
          className="search-input"
        />
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Boxes</th><th>Cores</th><th></th></tr></thead>
            <tbody>
              {locations === null
                ? <SkeletonRows cols={['40%', '60px', '60px', null]} />
                : visible.map(loc => (
                  <tr
                    key={loc.id}
                    className={editId === loc.id ? '' : 'row-clickable'}
                    onClick={e => { if (editId === loc.id || e.target.closest('a, button, input, form')) return; navigate(`/locations/${loc.id}`); }}
                  >
                    {editId === loc.id ? (
                      <td colSpan={4}>
                        <form onSubmit={handleEdit} className="inline-form">
                          <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus className="input-sm" />
                          <button className="btn btn-success" disabled={saving || !editName.trim()}>Save</button>
                          <button type="button" className="btn btn-secondary" onClick={() => setEditId(null)}>Cancel</button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td>{loc.name}</td>
                        <td className="text-muted">{loc.box_count}</td>
                        <td className="text-muted">{loc.core_count}</td>
                        <td className="col-shrink">
                          {!ro && (
                            <div className="row-actions">
                              <button className="btn btn-secondary btn-sm" onClick={() => startEdit(loc)}>Rename</button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(loc)}>Delete</button>
                            </div>
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              }
              {locations !== null && visible.length === 0 && <tr><td colSpan={4} className="empty">{q ? 'No matches' : 'No storage locations yet'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
