// Shown only on phones / small touch screens (CSS-driven, see globals.css).
// The canvas is a desktop tool, so on mobile we prompt people to switch rather
// than let them fight an unusable node canvas.
export default function MobileGate() {
  return (
    <div className="mobile-gate" role="dialog" aria-modal="true" aria-label="Open LOHO KUR on desktop">
      <div className="mg-card">
        <span className="mg-mark">LOHO KUR</span>
        <svg className="mg-ic" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="2.5" y="4" width="19" height="12.5" rx="1.5" />
          <path d="M9 20h6M12 16.5V20" />
        </svg>
        <h1 className="mg-h">Best on desktop</h1>
        <p className="mg-p">The canvas needs room to work. Open LOHO KUR on a laptop or desktop to design — idea to shipment.</p>
        <span className="mg-url">lohokur-app.vercel.app</span>
      </div>
    </div>
  );
}
