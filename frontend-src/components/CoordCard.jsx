import MapPicker from './MapPicker.jsx';
import LeafletMap from './LeafletMap.jsx';

export default function CoordCard({
  editing = false,
  lat,
  lng,
  onChange,
  mapLabel = '',
  latBadge,
  lngBadge,
  latHint,
  lngHint,
  extraPoints = [],
}) {
  const latNum = lat !== '' && lat != null ? Number(lat) : null;
  const lngNum = lng !== '' && lng != null ? Number(lng) : null;
  const hasCoords = latNum != null && lngNum != null;

  if (!editing && !hasCoords && extraPoints.length === 0) return null;

  const allPoints = [
    ...(hasCoords ? [{ lat: latNum, lng: lngNum, label: mapLabel }] : []),
    ...extraPoints,
  ];

  const legend = [
    ...(hasCoords ? [{ color: '#3388ff', label: mapLabel || 'Location' }] : []),
    ...(extraPoints.length > 0 ? [{ color: '#22c55e', label: 'Tubes (own coords)' }] : []),
  ];

  return (
    <div className="card mt-4">
      <div className="card-body">
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Latitude{latBadge && <> {latBadge}</>}</label>
            {editing ? (
              <>
                <input
                  type="number"
                  step="any"
                  value={lat ?? ''}
                  onChange={e => onChange(e.target.value, lng)}
                  placeholder="e.g. 39.0968"
                />
                {latHint && <p className="form-hint muted">{latHint}</p>}
              </>
            ) : (
              <span>{latNum ?? '—'}</span>
            )}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Longitude{lngBadge && <> {lngBadge}</>}</label>
            {editing ? (
              <>
                <input
                  type="number"
                  step="any"
                  value={lng ?? ''}
                  onChange={e => onChange(lat, e.target.value)}
                  placeholder="e.g. -120.0324"
                />
                {lngHint && <p className="form-hint muted">{lngHint}</p>}
              </>
            ) : (
              <span>{lngNum ?? '—'}</span>
            )}
          </div>
        </div>
      </div>
      {editing && (
        <MapPicker lat={latNum} lng={lngNum} onChange={onChange} />
      )}
      {!editing && allPoints.length > 0 && (
        <LeafletMap
          points={allPoints}
          legend={legend}
          className={null}
          exportName={mapLabel ? `${mapLabel}-map` : undefined}
        />
      )}
    </div>
  );
}
