// Shows a tube's own value, or the value it inherits from its core marked with an "inherited" badge.
export default function InheritedValue({ own, inherited, from = 'Inherited from core' }) {
  if (own) return own;
  if (inherited == null || inherited === '') return '—';
  return <>{inherited}<span className="badge badge-inherited" data-tooltip={from}>inherited</span></>;
}

export function coreLabel(t) {
  return t.core_barcode ? `From core: ${t.core_barcode}${t.core_name ? ` — ${t.core_name}` : ''}` : undefined;
}
