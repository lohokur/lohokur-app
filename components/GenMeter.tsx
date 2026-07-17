'use client';

import { useMe } from '@/lib/use-billing';
import { openProfile } from '@/lib/profile';

// Always-visible "AI generations this month" meter. Ticks down live after each
// render (useMe refreshes on the lk-gen-used event); click opens My profile.
export default function GenMeter() {
  const me = useMe();
  if (!me) return null;

  const cap = me.entitlements.generations;
  const finite = cap !== Infinity;
  const used = me.gensUsed;
  const remaining = finite ? Math.max(0, cap - used) : Infinity;
  const pct = finite ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const out = finite && remaining <= 0;
  const low = finite && remaining > 0 && remaining <= Math.max(1, Math.ceil(cap * 0.2));

  return (
    <button
      type="button"
      onClick={openProfile}
      className={`genmeter${out ? ' out' : low ? ' low' : ''}`}
      title={out ? 'Out of generations — open profile to upgrade' : `${remaining === Infinity ? '' : remaining + ' '}AI generations left this month`}
    >
      <svg className="gm-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>
      <span className="gm-count">{finite ? `${used} / ${cap}` : used}</span>
      {finite && <span className="gm-bar"><span className="gm-fill" style={{ width: `${pct}%` }} /></span>}
      {out && <span className="gm-up">Upgrade</span>}
    </button>
  );
}
