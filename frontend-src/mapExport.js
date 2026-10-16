// Renders the current view of a Leaflet map to a canvas at a higher pixel
// density. Tiles are re-fetched at a deeper zoom level so the result is
// genuinely sharper than a screenshot, not an upscaled copy of one.

const TILE_SIZE = 256;
const MAX_TILE_ZOOM = 19;
const ATTRIBUTION = '© OpenStreetMap contributors';
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const EXPORT_SCALES = [1, 2, 4];

export function tileZoomFor(zoom, scale) {
  return Math.max(0, Math.min(MAX_TILE_ZOOM, Math.round(zoom + Math.log2(scale))));
}

// Tiles covering a view; all positions and sizes are in output (device) pixels.
export function tilesForView({ originX, originY, width, height, tilePx, tileZoom }) {
  const n = 2 ** tileZoom;
  const tiles = [];
  for (let y = Math.floor(originY / tilePx); y * tilePx < originY + height; y++) {
    if (y < 0 || y >= n) continue;
    for (let x = Math.floor(originX / tilePx); x * tilePx < originX + width; x++) {
      const wrappedX = ((x % n) + n) % n;
      tiles.push({
        url: `https://tile.openstreetmap.org/${tileZoom}/${wrappedX}/${y}.png`,
        dx: x * tilePx - originX,
        dy: y * tilePx - originY,
        size: tilePx,
      });
    }
  }
  return tiles;
}

function loadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function drawMarker(ctx, x, y, color) {
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color || '#3388ff';
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'white';
  ctx.stroke();
}

// Mirrors Leaflet's default attribution control (bottom-right).
function drawAttribution(ctx, width, height) {
  ctx.font = `12px ${FONT}`;
  const w = ctx.measureText(ATTRIBUTION).width + 10;
  const h = 17;
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(width - w, height - h, w, h);
  ctx.fillStyle = '#333';
  ctx.textBaseline = 'middle';
  ctx.fillText(ATTRIBUTION, width - w + 5, height - h / 2);
}

// Mirrors the .legend box drawn inside the map iframe (bottom: 20px, right: 10px).
function drawLegend(ctx, legend, width, height) {
  ctx.font = `12px ${FONT}`;
  const rowH = 21.6;
  const textW = Math.max(...legend.map(l => ctx.measureText(l.label).width));
  const w = 10 + 16 + 6 + textW + 10;
  const h = 12 + rowH * legend.length;
  const x = width - 10 - w;
  const y = height - 20 - h;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 4);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = 'middle';
  legend.forEach((l, i) => {
    const cx = x + 10 + 8;
    const cy = y + 6 + rowH * i + rowH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = l.color;
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillText(l.label, x + 10 + 16 + 6, cy);
  });
}

export async function renderMapImage(map, { points = [], legend = [], scale = 2 }) {
  const zoom = map.getZoom();
  const { min } = map.getPixelBounds();
  const { x: width, y: height } = map.getSize();
  const tileZoom = tileZoomFor(zoom, scale);

  // Snap the origin to the output pixel grid so adjacent tiles don't seam.
  const originX = Math.round(min.x * scale);
  const originY = Math.round(min.y * scale);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tiles = tilesForView({
    originX, originY,
    width: canvas.width, height: canvas.height,
    tilePx: TILE_SIZE * 2 ** (zoom - tileZoom) * scale,
    tileZoom,
  });
  const images = await Promise.all(tiles.map(t => loadImage(t.url)));
  tiles.forEach((t, i) => {
    if (images[i]) ctx.drawImage(images[i], t.dx, t.dy, t.size, t.size);
  });

  // Overlays are drawn in CSS pixels, matching the on-screen map.
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  for (const p of points) {
    const pt = map.project([p.lat, p.lng], zoom);
    drawMarker(ctx, (pt.x * scale - originX) / scale, (pt.y * scale - originY) / scale, p.color);
  }
  drawAttribution(ctx, width, height);
  if (legend.length > 1) drawLegend(ctx, legend, width, height);

  return canvas;
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), type, quality);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Safari silently falls back to PNG for unsupported types like WebP.
export function canEncode(type) {
  try {
    return document.createElement('canvas').toDataURL(type).startsWith(`data:${type}`);
  } catch {
    return false;
  }
}

export function canCopyImage() {
  return typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
}
