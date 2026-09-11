'use client';

import { openPaywall } from '@/lib/paywall';

// A locked side/back slot for the free plan: shows the FREE front image, blurred,
// with a lock + paywall prompt on top. No new generation is made — it reuses the
// front image the user already has. Tapping opens the upgrade paywall.
export default function LockedView({ src, label, onClick }: { src?: string; label: string; onClick?: () => void }) {
  return (
    <button
      className="view-locked nodrag"
      onClick={(e) => { e.stopPropagation(); (onClick ?? openPaywall)(); }}
      title={`Unlock ${label}`}
      aria-label={`Unlock ${label}`}
    >
      {src ? <img className="view-locked-img" src={src} alt="" draggable={false} /> : <span className="view-locked-bg" />}
      <span className="view-locked-overlay">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
        <span className="view-locked-label">Unlock {label}</span>
      </span>
    </button>
  );
}
