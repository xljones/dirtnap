import { useState, useRef, useEffect } from 'react';

export default function ExportDropdown({
  label,
  disabled,
  options,
  className = '',
  buttonClassName = 'btn btn-secondary',
  ariaLabel,
  chevron = true,
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    // Clicks inside an iframe (e.g. a map) never reach this document, but blur the window.
    function handleBlur() { setOpen(false); }
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('blur', handleBlur);
    };
  }, [open]);

  function toggle() {
    if (!open) onOpen?.();
    setOpen(v => !v);
  }

  return (
    <div className={`export-dropdown ${className}`.trim()} ref={ref}>
      <button
        type="button"
        className={buttonClassName}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={toggle}
      >
        {label}
        {chevron && <span className="export-dropdown-chevron">▾</span>}
      </button>
      {open && (
        <div className="export-dropdown-menu">
          {options.map((opt, i) => {
            if (opt.divider) return <hr key={i} className="export-dropdown-divider" />;
            if (opt.type === 'checkbox') return (
              <label key={opt.label} className="export-dropdown-checkbox">
                <input type="checkbox" checked={opt.checked} onChange={opt.onChange} />
                {opt.label}
              </label>
            );
            if (opt.type === 'choice') return (
              <div key={opt.label} className="export-dropdown-choice">
                <div>
                  {opt.label}
                  {opt.note && <span className="export-dropdown-note">{opt.note}</span>}
                </div>
                <div className="export-dropdown-choice-group">
                  {opt.choices.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      className={`btn btn-secondary btn-sm${c.value === opt.value ? ' btn-active' : ''}`}
                      aria-pressed={c.value === opt.value}
                      onClick={() => opt.onChange(c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            );
            return (
              <button
                key={opt.label}
                type="button"
                className="export-dropdown-item"
                onClick={() => { opt.onClick(); setOpen(false); }}
              >
                {opt.label}
                {opt.note && <span className="export-dropdown-note">{opt.note}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
