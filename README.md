# LOHO KUR

A node-based canvas for taking a garment from an idea to a finished, manufactured
product — in one continuous workspace.

You start with a sketch, a photo or a typed prompt. Each step becomes a node on an
infinite canvas, and each node feeds the next: the design gets rendered onto a
model, traced into a sewing pattern, written up as a factory tech pack, quoted by
a real manufacturer, paid for, produced, and shipped. Nothing is exported and
re-imported by hand — the output of one stage is literally the input wire of the
next.

Built with Next.js 16 (App Router), React 19, React Flow, Supabase, Stripe and
image models served through fal.ai.

---

## The idea

Getting a garment made is a chain of disconnected tools and middlemen: sketch in
one app, render in another, pattern in a third, a tech pack in a spreadsheet,
then weeks of email with a factory that may never reply. Every handover loses
information, and the whole thing assumes you already know the vocabulary.

This app collapses that chain into a single canvas. The pipeline is modelled as
typed nodes with enforced connections, so the tool knows what a design is at
every stage and can do the translation work itself — a pattern is derived from
the actual render, a tech pack is written from the actual garment, a quote is
priced against the actual complexity of what you drew.

The intent is that someone with a drawing and no industry contacts can reach a
physical sample without leaving the page.

---

## The pipeline

Nodes are placed from a dock (or single-key hotkeys) and wired together. The
allowed connections are defined in `lib/nodeTypes.ts` — you can only wire a node
into a stage that legitimately follows it.

| Stage | Key | What it does |
| --- | --- | --- |
| **Sketch** | `s` | Draw on a built-in pad, upload an image, or type a prompt. Prompts render in a house style: a single garment on an invisible ghost mannequin, floating on white. Holds three views (front / side / back). |
| **Model** | `v` | Places the design onto a chosen base figure — a real photograph of a faceless model in a bare room. The prompt locks framing, pose, room and lighting so only the clothing changes. Extra plugged-in images act as material and styling references, not as separate objects. |
| **Image** | `w` | A free-form render node. Connect anything — a render, a reference, another Image node — and re-render the combination. Also handles annotation: draw panels straight onto a render and write the material next to them, and the edit is re-rendered as real, correctly draped fabric with the construction marks removed. |
| **Pattern maker** | `p` | Two phases in one node. First it segments the look and extracts a single garment off the figure as a clean product shot. Then it traces that garment into a flat 2D pattern: outline, refine, deconstruct into separated panels, and number every closed panel. Panel outlines are colour-coded by material — blue for the main body fabric, red for contrast, rib and trim. |
| **Techpack** | `t` | A vision model reads the garment and drafts a full factory-ready pack: points of measure with tolerances graded across XS–XXL, materials, bill of materials, trims, sewing operations, colourways and construction notes. Every field is editable. Colourway hex values are snapped to the nearest of 2,310 real Pantone colours. Generates technical flats, fabric and trim swatches, thread and a woven label from a drawing. Exports as a multi-page pack, or publishes to a public URL a factory can open with no account. |
| **Produce** | `c` | Pick a vetted manufacturer, choose one sample or a bulk run, and pay. Quotes are priced per garment from the tech pack's own complexity — materials, trims, embellishment — not a flat rate. Paying opens a tracked production order that moves through confirmed, materials, sampling, cutting, sewing, wash and finish, QC, complete. |
| **Ship** | `h` | Send the finished units to a whitelisted 3PL partner or to any address. |

Two stages are vaulted — **Extract** was folded into the Pattern maker and
**Manufacture** into Produce's bulk mode, but both remain registered node types
so older canvases still load and route correctly. A **Retailer** node
(submitting a finished collection to curated stockists) is shelved in the same
way.

Canvases also carry non-pipeline nodes: groups, sticky notes, and a library
strip of everything generated in the project.

---

## The liaison agent

The Produce node is not just a checkout. Once an order is placed, an agent drafts
the first message to the manufacturer — email via Gmail OAuth2, or WhatsApp via
Twilio — asking them to confirm the job, give a lead time and reply with an order
number. When the factory replies, the reply is parsed back into a structured
update: which production stage it maps to, a one-line summary, the factory order
number, and any carrier and tracking number.

Until real contacts and credentials are configured, orders advance on a
deterministic simulated ticker, so the flow is demonstrable end to end. A real
agent engagement pauses the simulation rather than fighting it.

---

## Pricing engine

Sample and bulk prices are derived, never hard-coded per product
(`lib/pricing.ts`):

```
charge = (factoryCost × buffer + shipping + handling) × (1 + margin)
charge = (charge + stripeFlat) / (1 − stripePct)   // gross up so card fees don't eat margin
charge = max(charge, floor)                        // floor covers fixed cost on tiny items
```

Every constant the business depends on — safety buffer, courier cost, handling
overhead, margin, card fees, minimum charge — lives in one object, so the
economics can be retuned in one place. A line-item breakdown is available for
showing the customer exactly what they are paying for.

---

## Plans and metering

Four tiers (`lib/entitlements.ts`), shown as Free, Starter, Pro and Max. The
model is pay-first: a free account can sketch, explore the canvas and place any
node type, but gets zero AI generations. Paid plans lift the caps, unlock side
and back views and tech-pack material generation, and render on the higher
quality image model; free would render on the faster, cheaper one.

Metering is server-authoritative and tamper-proof by construction:

- **Generations** are consumed through a Postgres `SECURITY DEFINER` function
  that does an atomic check-and-increment under a row lock, so concurrent
  requests cannot overspend a cap. The counter resets on a calendar month
  boundary.
- **Failed generations are refunded** — if the image call itself errors, the
  credit goes back. You are never charged for the app's own failures.
- **Project counts** are enforced by a `BEFORE INSERT` trigger, because projects
  are written straight from the browser under row-level security.
- **Row-level security** lets a user read only their own profile. There is
  deliberately no client-side insert, update or delete policy: the only writers
  are the Stripe webhook (service role) and the definer functions.
- If the database is unreachable, metering **fails open** — a degraded billing
  table never blocks the core product.

Billing runs on live Stripe Checkout with a customer portal, monthly and annual
cadences (annual is a 20% discount), and a webhook that reconciles subscription
state back into the profile.

---

## Architecture

```
app/
  page.tsx              project gallery (procedural generative-art covers)
  studio/[id]/          the canvas — StudioCanvas.tsx is the core
  pricing, profile, login, auth/callback
  admin/                analytics: activation, renders, tiers, signups, logins
  tp/[id]/              public tech-pack viewer (no auth, for manufacturers)
  api/
    imagine, visualise, annotate, extract, segment, pattern   AI pipeline
    techpack, techpack/assets, techpack/share                 packs and export
    projects, persist-image, identities                       data
    billing/*, produce/pay                                    Stripe
    liaison/parse, liaison/send                               manufacturer comms
components/   ~50 node, panel and canvas components
lib/          domain logic, providers, entitlements, pricing, storage
supabase/migrations/    billing, reconcile, render storage, admin analytics
proxy.ts      auth boundary
```

**Canvas.** React Flow with custom node types per stage, custom wire edges,
selection, grouping, hotkeys, a dock, a library drawer and a full-screen
Procreate-style sketch workspace that opens immersive by default with three
brushes, a colour wheel and a size control — the full tool and layer set is
behind an expand button.

**Image generation is provider-agnostic** (`lib/imagegen.ts`). With a fal.ai key
it goes through fal (Nano Banana Pro, and the cheaper Nano Banana for the free
tier), which is the production path and works anywhere including serverless.
Without one, it falls back to Gemini via Vertex AI and Application Default
Credentials for local development. Segmentation runs on a fast Gemini model with
thinking disabled; tech-pack drafting and the liaison agent run on OpenAI.

**Renders are offloaded.** Generated images used to be stored as base64 inside
the project flow in Postgres JSONB, which bloated rows and slowed every save.
Now every render is uploaded to a public Supabase Storage bucket and only the URL
is kept on the canvas. The path is deliberately hybrid: old base64 canvases keep
working untouched, storage being unconfigured returns the image unchanged, and a
failed upload falls back to a self-contained data URL. A render is never lost.

**Everything slow is bounded.** Image jobs, storage fetches and uploads all race
a timeout, because a stuck job would otherwise hang until the serverless function
is killed — and stack into minutes when several run in sequence. Account-level
provider failures are collapsed into one clear, user-safe message instead of a
raw `Forbidden`.

**Auth** is Supabase, enforced in `proxy.ts`. API routes enforce their own auth;
static assets are allowed through unauthenticated so images do not get redirected
to the login page and render as broken links. There is an additional
password gate in front of the whole app while it is pre-release.

---

## Running it

```bash
npm install
npm run dev     # http://localhost:3000
```

The app degrades gracefully without a backend: with no Supabase configured,
projects fall back to local storage and metering is skipped entirely, so the
canvas and the pipeline still work.

For the full stack, configure:

| Group | Variables |
| --- | --- |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_HAS_DB` |
| Images | `FAL_KEY` (production) or `GOOGLE_GENAI_USE_VERTEXAI` + `GOOGLE_CLOUD_PROJECT` (local) |
| Language models | `OPENAI_API_KEY`, `GEMINI_API_KEY` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICE_*` |
| Storage buckets | `RENDER_BUCKET`, `TECHPACK_BUCKET` |
| Liaison | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `SOURCING_FROM`, `TWILIO_*` |
| Access gate | `GATE_PASSWORD`, `GATE_TOKEN` |

Then run the migrations in `supabase/migrations/` in order, in the Supabase SQL
editor. They are idempotent and safe to re-run.

Note that tier caps exist in two places on purpose — `lib/entitlements.ts` for
the UI and `project_limit()` in `0001_billing.sql` for server-side enforcement.
Keep them in sync.

---

## Status

Pre-release and gated. The design, render, pattern, tech-pack, billing and
metering paths are live and real — Stripe charges real money and image
generation costs real credits. Manufacturer comms are real once credentials are
set; production-order progress and retailer submission are simulated behind the
same interfaces the real integrations will use.
