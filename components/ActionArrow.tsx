// The shared node action symbol — an upload/send up-arrow (Flora-style).
// Used on every node's process/generate trigger so they read as one system.
export function ActionArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20V6" />
      <path d="m6 12 6-6 6 6" />
    </svg>
  );
}
