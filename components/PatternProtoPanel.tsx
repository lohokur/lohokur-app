'use client';

import { useMemo, useState } from 'react';
import { GARMENTS, flatten, toSVG } from '@/lib/flatten';

export default function PatternProtoPanel({
  open,
  onGenerated,
  onClose,
}: {
  open: boolean;
  onGenerated: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [key, setKey] = useState('bodice');
  const g = GARMENTS.find((x) => x.key === key) ?? GARMENTS[0];

  const { svg, dist } = useMemo(() => {
    const r = flatten(g.mesh);
    return { svg: toSVG(r), dist: r.meanDistortion };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const use = () => {
    const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    onGenerated(url);
    onClose();
  };

  return (
    <aside className={`patternpanel${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="sp-head">
        <span>Pattern maker · flatten</span>
        <button className="sp-x" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="pm-views">
        {GARMENTS.map((x) => (
          <button key={x.key} className={key === x.key ? 'on' : ''} onClick={() => setKey(x.key)}>{x.label}</button>
        ))}
      </div>
      <div className="pm-note">{g.note}</div>

      <div className="pm-stage" dangerouslySetInnerHTML={{ __html: svg }} />

      <div className="pm-legend">
        <span>flat</span>
        <i className="pm-bar" />
        <span>dart&nbsp;needed</span>
        <b>{(dist * 100).toFixed(1)}% avg stretch</b>
      </div>

      <div className="pm-foot">
        <button className="sp-done" onClick={use}>Use pattern</button>
      </div>
    </aside>
  );
}
