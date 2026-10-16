import { useState } from 'react';
import ExportDropdown from './ExportDropdown.jsx';
import { useToast } from './Toast.jsx';
import {
  EXPORT_SCALES, renderMapImage, canvasToBlob, downloadBlob, canEncode, canCopyImage,
} from '../mapExport.js';

const FORMATS = [
  { label: 'PNG', type: 'image/png', ext: 'png' },
  { label: 'JPEG', type: 'image/jpeg', ext: 'jpg', quality: 0.92 },
  // Every browser encodes PNG and JPEG; WebP needs probing (Safari can't).
  { label: 'WebP', type: 'image/webp', ext: 'webp', quality: 0.92, probe: true },
];

export default function MapExportMenu({ getMap, points, legend, filename = 'map' }) {
  const toast = useToast();
  const [scale, setScale] = useState(2);
  const [size, setSize] = useState(null);
  const [busy, setBusy] = useState(false);

  const safeName = filename.replace(/[^\w.-]+/g, '-');

  function render() {
    const map = getMap();
    if (!map) return Promise.reject(new Error('Map is still loading'));
    return renderMapImage(map, { points, legend, scale });
  }

  async function run(action, successMessage) {
    setBusy(true);
    try {
      await action();
      if (successMessage) toast?.(successMessage);
    } catch (e) {
      toast?.(`Map export failed: ${e.message}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function download(fmt) {
    run(async () => {
      const blob = await canvasToBlob(await render(), fmt.type, fmt.quality);
      downloadBlob(blob, `${safeName}.${fmt.ext}`);
    });
  }

  function copy() {
    // Safari requires clipboard.write() to be called synchronously within the
    // click, so hand it a promise for the image rather than awaiting first.
    const blob = render().then(c => canvasToBlob(c, 'image/png'));
    run(() => navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]), 'Map image copied');
  }

  const dims = size && `${Math.round(size.x * scale)} × ${Math.round(size.y * scale)} px`;

  const options = [
    {
      type: 'choice',
      label: 'Resolution',
      value: scale,
      choices: EXPORT_SCALES.map(s => ({ value: s, label: `${s}×` })),
      onChange: setScale,
      note: dims,
    },
    { divider: true },
    ...FORMATS.filter(f => !f.probe || canEncode(f.type)).map(f => ({
      label: `Download ${f.label}`,
      onClick: () => download(f),
    })),
    ...(canCopyImage() ? [{ label: 'Copy image', note: 'PNG, to paste elsewhere', onClick: copy }] : []),
  ];

  return (
    <ExportDropdown
      className="map-export"
      buttonClassName="map-export-btn"
      label={busy ? '…' : '⋯'}
      ariaLabel="Map export options"
      chevron={false}
      disabled={busy}
      options={options}
      onOpen={() => setSize(getMap()?.getSize() ?? null)}
    />
  );
}
