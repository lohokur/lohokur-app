// Shared node action symbols — one design language across every node card.
//   ActionArrow — send / generate up-arrow.
//   UploadIcon  — arrow rising out of a tray: upload a file.
//   OpenIcon    — expand corners: open the node's editor / pick / find.
export function ActionArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20V6" />
      <path d="m6 12 6-6 6 6" />
    </svg>
  );
}

export function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 8l5-5 5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H6a2 2 0 0 0-2 2v2" />
      <path d="M16 3h2a2 2 0 0 1 2 2v2" />
      <path d="M8 21H6a2 2 0 0 1-2-2v-2" />
      <path d="M16 21h2a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
