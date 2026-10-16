import { describe, it, expect } from 'vitest';
import { tileZoomFor, tilesForView } from './mapExport.js';

describe('tileZoomFor', () => {
  it('fetches deeper tiles for higher scales', () => {
    expect(tileZoomFor(10, 1)).toBe(10);
    expect(tileZoomFor(10, 2)).toBe(11);
    expect(tileZoomFor(10, 4)).toBe(12);
  });

  it('clamps to the deepest zoom OSM serves', () => {
    expect(tileZoomFor(18, 4)).toBe(19);
  });
});

describe('tilesForView', () => {
  it('covers the view with tiles positioned relative to its origin', () => {
    const tiles = tilesForView({ originX: 300, originY: 10, width: 512, height: 256, tilePx: 256, tileZoom: 3 });
    expect(tiles.map(t => [t.url, t.dx, t.dy])).toEqual([
      ['https://tile.openstreetmap.org/3/1/0.png', -44, -10],
      ['https://tile.openstreetmap.org/3/2/0.png', 212, -10],
      ['https://tile.openstreetmap.org/3/3/0.png', 468, -10],
      ['https://tile.openstreetmap.org/3/1/1.png', -44, 246],
      ['https://tile.openstreetmap.org/3/2/1.png', 212, 246],
      ['https://tile.openstreetmap.org/3/3/1.png', 468, 246],
    ]);
  });

  it('wraps x across the antimeridian and skips y outside the world', () => {
    const tiles = tilesForView({ originX: -256, originY: -256, width: 512, height: 512, tilePx: 256, tileZoom: 1 });
    expect(tiles.map(t => t.url)).toEqual([
      'https://tile.openstreetmap.org/1/1/0.png',
      'https://tile.openstreetmap.org/1/0/0.png',
    ]);
  });

  it('scales tile size when the tile zoom is clamped', () => {
    const [tile] = tilesForView({ originX: 0, originY: 0, width: 10, height: 10, tilePx: 512, tileZoom: 19 });
    expect(tile.size).toBe(512);
  });
});
