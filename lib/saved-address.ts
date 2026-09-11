'use client';

// The delivery address collected at produce checkout, remembered so it's typed
// once and pre-filled every time after. Stored per-browser (localStorage) for now;
// account-level sync (cross-device) is a follow-up that needs a profiles column.
import { type Address, emptyAddress } from '@/lib/sample';

const KEY = 'lk-ship-address';

export function loadSavedAddress(): Address {
  if (typeof window === 'undefined') return emptyAddress();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...emptyAddress(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return emptyAddress();
}

export function saveAddress(a: Address): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

export function addressValid(a: Address): boolean {
  return !!a.line1?.trim() && !!a.city?.trim() && !!a.country?.trim();
}
