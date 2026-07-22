'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

// A seamless, click-only signup survey. Shows once, right after a user first
// lands authenticated, then never again. Answers are written to the Supabase
// auth user_metadata (no schema/RLS work) and are visible in the admin user list.
//   account — individual vs organisation
//   role    — who they are
//   source  — where they came from

type Opt = { value: string; label: string; icon: ReactNode };
type Step = { key: 'account' | 'role' | 'source'; q: string; sub: string; cols: number; options: Opt[] };

// 24x24 line icons (stroke, no fill) — matches the rest of the app.
const I = {
  person: <><circle cx="12" cy="8" r="3.4" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /></>,
  team: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><path d="M16 6.2a3 3 0 0 1 0 5.6" /><path d="M17.5 13.4A5.5 5.5 0 0 1 20.5 18" /></>,
  pen: <path d="M4 20l3.6-.9L18.1 8.6a1.8 1.8 0 0 0 0-2.6l-1.1-1.1a1.8 1.8 0 0 0-2.6 0L3.9 15.4 3 19z" />,
  tag: <><path d="M20 12.5 12.5 20 4 11.5V4h7.5z" /><circle cx="8.5" cy="8.5" r="1.3" /></>,
  studio: <><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /></>,
  factory: <><path d="M3 21V10l6 4V10l6 4V10l6 4v7z" /><path d="M3 21h18" /></>,
  code: <><path d="M9 8l-4 4 4 4" /><path d="M15 8l4 4-4 4" /></>,
  cap: <><path d="M3 8.5 12 4l9 4.5-9 4.5z" /><path d="M6.5 10.8V16c0 1 2.5 2.4 5.5 2.4S17.5 17 17.5 16v-5.2" /></>,
  camera: <><rect x="3" y="6.5" width="18" height="13" rx="3" /><circle cx="12" cy="13" r="3.4" /><path d="M8 6.5l1.2-2h5.6L16 6.5" /></>,
  note: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  ex: <><path d="M6 6l12 12M18 6L6 18" /></>,
  play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" /></>,
  people: <><circle cx="8.5" cy="9" r="2.6" /><circle cx="16" cy="9" r="2.6" /><path d="M4 19a4.5 4.5 0 0 1 9 0" /><path d="M13 19a4.5 4.5 0 0 1 7-3.6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" /></>,
};

const STEPS: Step[] = [
  {
    key: 'account', q: 'How are you building?', sub: 'So we can shape the studio around you.', cols: 2,
    options: [
      { value: 'individual', label: 'Just me', icon: I.person },
      { value: 'organisation', label: 'A team or company', icon: I.team },
    ],
  },
  {
    key: 'role', q: 'What describes you best?', sub: 'Pick the closest — you can be more than one.', cols: 3,
    options: [
      { value: 'designer', label: 'Independent designer', icon: I.pen },
      { value: 'brand', label: 'Fashion brand / label', icon: I.tag },
      { value: 'studio', label: 'Studio or agency', icon: I.studio },
      { value: 'manufacturer', label: 'Manufacturer / supplier', icon: I.factory },
      { value: 'developer', label: 'Developer / technologist', icon: I.code },
      { value: 'student', label: 'Student / just exploring', icon: I.cap },
    ],
  },
  {
    key: 'source', q: 'How did you find us?', sub: 'Last one — then you’re in.', cols: 3,
    options: [
      { value: 'instagram', label: 'Instagram', icon: I.camera },
      { value: 'tiktok', label: 'TikTok', icon: I.note },
      { value: 'x', label: 'X (Twitter)', icon: I.ex },
      { value: 'youtube', label: 'YouTube', icon: I.play },
      { value: 'friend', label: 'Word of mouth', icon: I.people },
      { value: 'search', label: 'Search', icon: I.search },
    ],
  },
];

type Phase = 'checking' | 'active' | 'saving' | 'done' | 'hidden';

export default function OnboardingWizard() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // only show for a signed-in user who hasn't been through it
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { data: { user } } = await supabaseBrowser().auth.getUser();
        // Owner account always sees the survey on login (preview/QA), regardless of onboarded state.
        const alwaysShow = user?.email?.toLowerCase() === 'lohokur123@gmail.com';
        if (live) setPhase(user && (alwaysShow || !user.user_metadata?.onboarded_at) ? 'active' : 'hidden');
      } catch {
        if (live) setPhase('hidden');
      }
    })();
    return () => { live = false; };
  }, []);

  const finish = useCallback(async (final: Record<string, string>, skipped = false) => {
    setPhase('saving');
    try {
      await supabaseBrowser().auth.updateUser({
        data: {
          onboarded_at: new Date().toISOString(),
          onboarding_skipped: skipped,
          lk_account_type: final.account ?? null,
          lk_role: final.role ?? null,
          lk_source: final.source ?? null,
        },
      });
    } catch { /* never block the app on the survey write */ }
    setPhase('done');
    // let the confirmation land, then dissolve to reveal the studio
    setTimeout(() => setPhase('hidden'), skipped ? 0 : 1100);
  }, []);

  const choose = (value: string) => {
    const key = STEPS[step].key;
    const next = { ...answers, [key]: value };
    setAnswers(next);
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish(next);
  };

  if (phase === 'checking' || phase === 'hidden') return null;

  const cur = STEPS[step];

  return (
    <div className={`onb${phase === 'done' ? ' onb-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="Welcome survey">
      <div className="onb-inner">
        <img className="onb-logo" src="/lk-logo.png" alt="LOHO KUR" draggable={false} />

        {phase === 'done' ? (
          <div className="onb-success" key="done">
            <span className="onb-check"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg></span>
            <h2 className="onb-q">You’re in.</h2>
            <p className="onb-sub">Taking you to the studio…</p>
          </div>
        ) : phase === 'saving' ? (
          <div className="onb-success" key="saving">
            <span className="onb-spin" aria-hidden="true" />
            <p className="onb-sub">Setting up your studio…</p>
          </div>
        ) : (
          <>
            <div className="onb-dots" aria-hidden="true">
              {STEPS.map((s, i) => <span key={s.key} className={`onb-dot${i === step ? ' on' : ''}${i < step ? ' done' : ''}`} />)}
            </div>

            <div className="onb-step" key={step}>
              <h2 className="onb-q">{cur.q}</h2>
              <p className="onb-sub">{cur.sub}</p>

              <div className={`onb-grid cols-${cur.cols}`}>
                {cur.options.map((o) => (
                  <button key={o.value} className="onb-opt" onClick={() => choose(o.value)}>
                    <span className="onb-ic"><svg viewBox="0 0 24 24" aria-hidden="true">{o.icon}</svg></span>
                    <span className="onb-lbl">{o.label}</span>
                  </button>
                ))}
              </div>

              <div className="onb-foot">
                {step > 0
                  ? <button className="onb-back" onClick={() => setStep(step - 1)}>← Back</button>
                  : <span />}
                <button className="onb-skip" onClick={() => finish(answers, true)}>Skip for now</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
