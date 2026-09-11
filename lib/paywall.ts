import type { Me } from './use-billing';

// Open the paywall modal from anywhere (a top-level <PaywallModal/> listens).
export function openPaywall() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('lk-paywall'));
}

// If the user has no generations left this month, open the paywall and return
// true so the caller can bail out *before* firing a render (no wasted wait).
// Reads the client's cached usage; the server 402 is still the backstop.
export function blockedByCap(me: Me | null): boolean {
  if (!me) return false;
  if (me.unlimited) return false; // owner accounts are never capped (admins still are)
  const cap = me.entitlements.generations;
  if (cap === Infinity) return false;
  if (me.gensUsed >= cap) {
    openPaywall();
    return true;
  }
  return false;
}
