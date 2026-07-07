'use client';

// Shell only — structure for the tech-pack editor. Logic comes later.
export default function TechpackPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <aside className={`techpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="tp-head">
        <span>Tech pack</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="tp-body">
        <div className="tp-flatbox">
          <span>flat sketch</span>
          <em>drops in from the connected pieces</em>
        </div>

        <section className="tp-sec">
          <div className="tp-sec-h">Points of measure</div>
          <table className="tp-table">
            <thead><tr><th>POM</th><th>S</th><th>M</th><th>L</th></tr></thead>
            <tbody>
              <tr><td className="ph">chest</td><td /><td /><td /></tr>
              <tr><td className="ph">length</td><td /><td /><td /></tr>
              <tr><td className="ph">sleeve</td><td /><td /><td /></tr>
            </tbody>
          </table>
          <button className="tp-add" disabled>+ add measurement</button>
        </section>

        <section className="tp-sec">
          <div className="tp-sec-h">Bill of materials</div>
          <div className="tp-rows">
            <div className="tp-row"><span className="ph">main fabric</span><span>—</span></div>
            <div className="tp-row"><span className="ph">trims</span><span>—</span></div>
            <div className="tp-row"><span className="ph">hardware</span><span>—</span></div>
          </div>
        </section>

        <section className="tp-sec">
          <div className="tp-sec-h">Colourway &amp; grading</div>
          <div className="tp-chips">
            <span className="tp-chip">XS</span><span className="tp-chip">S</span>
            <span className="tp-chip">M</span><span className="tp-chip">L</span><span className="tp-chip">XL</span>
          </div>
        </section>

        <div className="tp-soon">Editor logic coming soon</div>
      </div>

      <div className="tp-foot">
        <button className="sp-done" onClick={onClose}>Done</button>
      </div>
    </aside>
  );
}
