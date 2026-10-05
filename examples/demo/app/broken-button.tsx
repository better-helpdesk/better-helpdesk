'use client';

/** Throws on purpose: the widget records the error and offers it with the next bug report. */
export function BrokenButton() {
  return (
    <button
      type="button"
      className="btn btn-quiet"
      onClick={() => {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'eta')"
        );
      }}>
      Try the broken button
    </button>
  );
}
