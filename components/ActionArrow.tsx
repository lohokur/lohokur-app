// Shared node action symbols — one design language across every node card.
//   ActionArrow — upload / send up-arrow: process, generate, or upload a file.
//   OpenIcon    — expand corners: open the node's editor / pick / find.
export function ActionArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20V6" />
      <path d="m6 12 6-6 6 6" />
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
