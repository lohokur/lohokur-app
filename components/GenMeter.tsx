'use client';

import { useMe } from '@/lib/use-billing';
import { openProfile } from '@/lib/profile';

// Studio "ink" — a monthly creative resource shown as a fill level (how much you
// have), not a used-count. Refills on the 1st. Click opens My profile.
export default function GenMeter() {
  const me = useMe();
  if (!me) return null;

  const cap = me.entitlements.generations;
  const finite = cap !== Infinity;
  const remaining = finite ? Math.max(0, cap - me.gensUsed) : Infinity;
  const level = finite ? Math.max(0, Math.min(100, Math.round((remaining / cap) * 100))) : 100;
  const out = finite && remaining <= 0;
  const low = finite && remaining > 0 && remaining <= Math.max(1, Math.ceil(cap * 0.2));
  const label = out ? 'Out of ink' : low ? 'Low on ink' : 'Ink';

  return (
    <button
      type="button"
      onClick={openProfile}
      className={`genmeter${out ? ' out' : low ? ' low' : ''}`}
      title={out ? 'Out of ink — refills on the 1st' : 'Refills on the 1st'}
    >
      <svg className="gm-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" /></svg>
      <span className="gm-count">{label}</span>
      {finite && <span className="gm-bar"><span className="gm-fill" style={{ width: `${level}%` }} /></span>}
    </button>
  );
}
