import { useRef } from 'react';
import MapExportMenu from './MapExportMenu.jsx';

export default function LeafletMap({ points, height = 320, className = 'card card-map mt-4', legend = [], exportName = 'dirtnap-map' }) {
  const iframeRef = useRef(null);
  if (!points.length) return null;

  const safePoints = JSON.stringify(points).replace(/<\/script>/gi, '<\\/script>');
  const safeLegend = JSON.stringify(legend).replace(/<\/script>/gi, '<\\/script>');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
body{margin:0}
#map{height:100vh;width:100%}
.legend{position:absolute;bottom:20px;right:10px;background:white;padding:6px 10px;border-radius:4px;box-shadow:0 1px 5px rgba(0,0,0,.4);font-size:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;z-index:1000;line-height:1.8}
.legend-row{display:flex;align-items:center;gap:6px}
.legend-dot{width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,.25);flex-shrink:0}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
const pts=${safePoints};
const legend=${safeLegend};
const map=L.map('map');
window.leafletMap=map;
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors'}).addTo(map);
const markers=pts.map(p=>{
  const m=L.circleMarker([p.lat,p.lng],{radius:8,fillColor:p.color||'#3388ff',color:'white',weight:2,opacity:1,fillOpacity:0.9}).addTo(map);
  if(p.label)m.bindPopup(p.url?'<a href="'+p.url+'" target="_top">'+p.label+'</a>':p.label);
  return m;
});
if(pts.length===1){map.setView([pts[0].lat,pts[0].lng],13);}
else{map.fitBounds(L.featureGroup(markers).getBounds().pad(0.2));}
if(legend.length>1){
  const div=document.createElement('div');
  div.className='legend';
  div.innerHTML=legend.map(l=>'<div class="legend-row"><div class="legend-dot" style="background:'+l.color+'"></div>'+l.label+'</div>').join('');
  document.body.appendChild(div);
}
</script>
</body></html>`;

  const content = (
    <div className="map-export-wrap">
      <iframe
        ref={iframeRef}
        title="Map"
        width="100%"
        height={height}
        className="iframe-clean"
        srcDoc={html}
      />
      <MapExportMenu
        getMap={() => iframeRef.current?.contentWindow?.leafletMap}
        points={points}
        legend={legend}
        filename={exportName}
      />
    </div>
  );
  if (className) return <div className={className}>{content}</div>;
  return <div style={{ overflow: 'hidden', borderRadius: '0 0 var(--radius) var(--radius)' }}>{content}</div>;
}
