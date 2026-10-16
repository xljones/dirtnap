// Submit button joined to an optional "+ add another" button. The form's submit
// handler reads addAnotherRef.current to tell which one was clicked.
export default function CreateButtons({ label, saving, disabled, addAnotherRef }) {
  return (
    <div className="btn-split">
      <button
        className="btn btn-success"
        disabled={saving || disabled}
        onClick={() => { if (addAnotherRef) addAnotherRef.current = false; }}
      >
        {saving ? 'Saving…' : label}
      </button>
      {addAnotherRef && (
        <button
          className="btn btn-success"
          disabled={saving || disabled}
          onClick={() => { addAnotherRef.current = true; }}
          aria-label={`${label} and add another`}
        >
          + add another
        </button>
      )}
    </div>
  );
}
