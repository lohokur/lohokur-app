'use client';

import { useMe, startCheckout } from '@/lib/use-billing';
import { useState } from 'react';

// Small live countdown shown under the ink meter while a trial is running.
// Turns urgent in the last 2 days and offers one-tap upgrade so the line
// never actually closes on them.
export default function TrialBadge() {
  const me = useMe();
  const [busy, setBusy] = useState(false);

  if (!me?.onTrial) return null;
  const d = me.daysLeft;
  const urgent = d <= 2;

  const keep = async () => {
    setBusy(true);
    const err = await startCheckout('studio', 'monthly');
    if (err) setBusy(false); // else redirects
  };

  return (
    <button className={`trial-badge${urgent ? ' urgent' : ''}`} onClick={keep} disabled={busy} title="Keep your production line — upgrade to Studio">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <span className="tb-text">
        {busy ? 'Redirecting…' : (
          <>Trial · <b>{d} day{d === 1 ? '' : 's'} left</b>{urgent ? ' — keep it open' : ''}</>
        )}
      </span>
    </button>
  );
}
