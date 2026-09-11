// One-popout-at-a-time coordinator. Every slide-in popout (paywall, unlock,
// profile) and the canvas node panels (techpack, extract, …) share the right
// edge, so only one may be visible. When any opens it announces its id; every
// other popout listens and closes itself when the id isn't its own.
//
// The node panels all announce under the single id 'node' (they're already
// mutually exclusive via the canvas), so opening one closes the global popouts
// and vice versa.

export type PopoutId = 'paywall' | 'unlock' | 'profile' | 'node';

export function announcePopout(id: PopoutId) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('lk-popout', { detail: id }));
  }
}

// Subscribe to popout announcements. `onOther` fires with the opening id whenever
// a popout *other than* `self` opens — the caller closes itself. Returns an
// unsubscribe fn for effect cleanup.
export function onPopout(self: PopoutId, onOther: (opened: PopoutId) => void): () => void {
  const handler = (e: Event) => {
    const opened = (e as CustomEvent).detail as PopoutId;
    if (opened !== self) onOther(opened);
  };
  window.addEventListener('lk-popout', handler);
  return () => window.removeEventListener('lk-popout', handler);
}
