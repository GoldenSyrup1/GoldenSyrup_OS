# GoldenSyrup OS — CLAUDE.md

Personal **visual-first command centre** for Sriram. Not a product, not multi-user — one
dashboard that consumes every GoldenSyrup project and life domain at a glance.

## What it surfaces
1. **8 revolution pillars** — Government, Military/Security, Cyberspace, Finance, Law,
   Education, Trade, Business. Each shows status + progress + next action + Intel signal.
2. **Project dashboards** — WEPort, GoldenSyrup_Intel, Stall-In, claude_connector,
   TrackLink, StockUp, Cloud925, Solace.
3. **Relationship map** — contacts ↔ the projects they connect to (e.g. Peter Ratcliffe → WEPort).
4. **Hackathons + UNSW milestones**, job search, ETH trade tracking.

Design principle: **visual-first** — status nodes, progress rings, flowcharts, relationship
maps. No text walls. Eye-friendly dark theme.

## Stack
- **React 18 + TypeScript + Vite** frontend.
- **Tailwind CSS** for styling (golden-syrup palette in `tailwind.config.js`).
- **@xyflow/react** (React Flow) for relationship/flow graphs.
- **Vitest + Testing Library + jsdom** for tests.

## Data sources (layered)
- **Seed layer** — `src/data/seed.ts`, last-known state distilled from claude_connector memory.
- **Live layer (planned)** — adapters pulling from existing Railway backends
  (GoldenSyrup_Intel pillar signal, WEPort status, claude_connector memory via MCP/HTTP).
  Base URLs come from `VITE_*` env vars (see `.env.example`).

## App shell
Sidebar rail (`components/Sidebar.tsx`) switches between three views in `src/views/`:
- **Dashboard** — the original command centre (pillars, projects, relationship map, ETH, jobs…).
- **Cowork** — visual board over Claude for Desktop's Cowork. Cowork is desktop-only with no
  API, so the bridge is a JSON file it writes into a connected folder (`public/cowork-state.json`,
  override via `VITE_COWORK_STATE_URL`). Pick a category on the left → see its tasks' progress.
  Read-only + a clipboard "assign to Cowork" composer (browser can't write the local folder).
- **Architectures** — flowchart/block builder on React Flow. `Create → New Architecture` opens an
  editable canvas with a manual toolbar (add/connect/rename/delete blocks) **and** a prompt box
  that generates blocks via the architect runner. Saved to localStorage.
- **Fitness** — ability-first tracking: what Sriram can *do*, not what he did. The unit is an
  **ability** (handstand, pull-up, pistol squat, full bodyweight on two hands, a flat split, a
  540 kick), each owning an ordered **progression ladder**; progress is the share of that ladder
  actually owned, with partial credit per rung. Disciplines: calisthenics, plyometrics,
  isometrics, strength, cardio, flexibility, taekwondo. Saved to localStorage.
  **Everything is manual entry — Sriram owns the exercise content; the board ships empty and
  nothing is seeded, estimated, or synced from a device. Diet is deliberately out of scope.**
  Cardio/times set `lowerIsBetter` with a per-rung `start` baseline so a faster 5K earns credit;
  `binary` rungs turn a ladder into a checklist (the Cho Dan Bo → 1st Dan belt path).

## Runner seam (prompt → work)
`lib/runner.ts` (Command Console) and `lib/architect.ts` (Architectures) both split stub ⇄
orchestrator: a stub works with no infra/cost; when `VITE_OS_ORCHESTRATOR_BASE` is set they POST
to `/run` and `/architect` respectively. Keep new prompt surfaces on this pattern.

**The orchestrator (`orchestrator/`) is the backend half.** A local-only Express server on
:8787 serving both endpoints — one env var flips *both* surfaces off their stubs at once, so
they ship together:
- `POST /architect {prompt}` → `{blocks,links,note}`. Calls the Claude API with
  `output_config.format` + a JSON Schema, so the model is *constrained* to a valid graph
  rather than asked politely for one. **Costs money per prompt** — the stub is free.
  Model/effort are env knobs (`ARCHITECT_MODEL`, `ARCHITECT_EFFORT`), defaulting to
  `claude-sonnet-5` at `medium`: a handful of blocks from one sentence does not need Opus,
  and this is a box you hammer while iterating. Token counts are logged per call.
- `POST /run {prompt,path,architecture?}` → NDJSON `{log|status|result|error}`, spawning
  `claude -p` in `path`. An attached `architecture` is rendered to text and prepended to the
  prompt inside `<architecture>` tags, so a diagram ships as context with the request.
- `GET|PUT /architectures` → the durable canvas. **Diagrams used to live only in browser
  localStorage, which made them invisible to Claude Code, Cowork and Claude, and killed them
  with the browser cache.** They now persist as one JSON file per architecture under
  `architectures/` (committed + versioned on purpose — an agent in this checkout can read
  them; `ARCHITECTURES_DIR` overrides). PUT replaces the whole set, so it prunes files for
  deleted architectures *and* the stale slug left by a rename. Browser side is the same
  stub ⇄ orchestrator seam (`src/lib/archStore.ts`): localStorage-only by default,
  disk-backed when the orchestrator is set, and it write-through caches to localStorage so
  an orchestrator that is down degrades to the old behaviour instead of a blank canvas.

Run it with `npm run orchestrator` (first time: `npm run orchestrator:install`). It holds
`ANTHROPIC_API_KEY`, so it binds loopback only and allowlists the dev/preview origins —
**never expose it to a network, and never move that key to a `VITE_` var** (see the security
rule below; that key is the whole reason this process exists). Schema + coercion live in
`orchestrator/lib/patch.js`, kept SDK-free so the root Vitest suite can unit-test it; the
browser still re-validates via `coercePatch`.

Two traps worth knowing, both found by driving the endpoints rather than reading the code:
- `express.json()` fully consumes the request body, after which **`req` fires `'close'`
  immediately** — killing a child process on that signal shoots it milliseconds after spawn.
  Watch `res`, not `req`.
- `claude -p` blocks ~3s waiting for stdin unless you spawn it with `stdio: ['ignore', ...]`.

## Deploying it as a real website (Railway)

**One service, one process, one URL.** The orchestrator serves the built `dist/` *and* the
API, so there is no separate frontend host, no CORS, and nothing to keep in sync. Railway
runs `npm run build:hosted` then `npm run start:hosted` (`railway.json`).

The three things that change the moment it is not on the laptop:

- **Auth becomes mandatory, enforced at boot.** The server calls itself hosted when `PORT`
  or `DATABASE_URL` is set, and then **refuses to start without `OS_PASSWORD`** — a public
  URL plus an Anthropic key plus no password is an open proxy billed to Sriram. The browser
  proves itself once and carries an httpOnly cookie (`orchestrator/lib/auth.js` — HMAC over
  an expiry, no JWT dependency parsing attacker-controlled tokens). `LoginGate` wraps `<App/>`
  *outside* it, so no view mounts and no adapter fetches before the lock state is known.
  Set `OS_SESSION_SECRET` too, or every redeploy signs you out (unset ⇒ random per boot).
- **`/run` turns itself off.** It spawns `claude -p` on the filesystem; on a hosted box there
  are no repos to work in and it would be plain remote code execution. Hosted returns 501 —
  Claude Code runs stay local, by design, not by oversight.
- **Storage moves to Postgres.** A container's disk is ephemeral, so `architectures/*.json`
  would die on redeploy. Attaching a Railway Postgres sets `DATABASE_URL`, which switches
  `orchestrator/lib/storage.js` from the file backend to a table. Same interface, chosen by
  environment rather than a flag anyone has to remember. Locally it stays files-in-the-repo,
  which is what keeps diagrams readable to agents in this checkout.

`build:hosted` bakes `VITE_OS_ORCHESTRATOR_BASE=same-origin` into the bundle — a sentinel
meaning "call relative paths" (`src/lib/env.ts`), because the base URL is then the empty
string, which is otherwise exactly how we spell *not configured*. It is a script rather than
a Railway variable so a forgotten build var can't silently ship a site running on stubs.

Railway variables to set on the **app** service: `ANTHROPIC_API_KEY`, `OS_PASSWORD`,
`OS_SESSION_SECRET`, `DATABASE_URL`. Do not set `PORT`.

**`DATABASE_URL` is not inherited — this is the trap.** Adding a Postgres to a Railway
project creates a *separate service* that owns the variable; the app service sees nothing
until you add a reference variable to it: `DATABASE_URL=${{Postgres.DATABASE_URL}}`. Miss it
and nothing breaks loudly — the server falls back to the file backend, works fine, and
quietly loses every diagram on the next deploy, which is the exact failure Postgres was
added to prevent. **Check the boot log for `architectures: postgres (postgres)`.** If it
says `filesystem`, the reference is missing.

Second Railway-specific gotcha: if the log shows *"The server does not support SSL
connections"*, set `PGSSLMODE=disable`. Railway's Postgres image is SSL-enabled, but the
in-project private endpoint often doesn't negotiate TLS and we default to requiring it.
That network is private to the project, so disabling it there costs nothing.

## Project structure
```
src/
  types.ts              shared domain types (incl. Cowork + Architecture types)
  data/seed.ts          seeded state from memory
  data/cowork.ts        Cowork bridge adapter (normalize + category rollup) — unit tested
  lib/util.ts           pure helpers (status color, progress aggregation) — unit tested
  lib/architecture.ts   architecture graph ops + React Flow projection — unit tested
  lib/architect.ts      prompt → graph patch (stub ⇄ orchestrator) — unit tested
  lib/archStore.ts      architecture persistence (localStorage ⇄ disk) — unit tested
  lib/auth.ts           browser half of the session auth (hosted only)
  components/LoginGate  password gate wrapping <App/> when the deployment is locked
  lib/fitness.ts        ability/ladder ops + progress maths + persistence — unit tested
  hooks/                useLiveData, useCommandConsole, useCowork, useArchitectures, useFitness
  components/           ProgressRing, StatusDot, Card, Sidebar, CoworkBoard, ArchitectureCanvas,
                        FitnessBoard, …
  views/                DashboardView, CoworkView, ArchitecturesView, FitnessView
  App.tsx               shell: sidebar + view switch
  test/setup.ts         jest-dom matchers
```

## Commands
- `npm run dev` — local dev server (port 5180).
- `npm run orchestrator` — local orchestrator on :8787 (`orchestrator:install` first run).
- `npm test` — run the Vitest suite (run mode).
- `npm run build` — typecheck + production build.
- `npm run lint` — typecheck only.
- `npm run build:hosted` / `npm run start:hosted` — what Railway runs (see Deploying above).
  To rehearse a deploy locally: `npm run build:hosted`, then
  `PORT=8899 OS_PASSWORD=... OS_SESSION_SECRET=... npm run start:hosted`.

## Conventions (standing rules — follow without being asked)
- **Testing is mandatory.** Every change ships with tests + a stated result. Pure logic in
  `lib/` must be unit-tested; views get smoke tests.
- **Security from the start.** No secrets in the repo. Anything `VITE_`-prefixed is bundled
  into the browser — never put a private secret there; prefer a backend proxy for tokens.
  CSP + referrer meta tags are set in `index.html`; tighten `connect-src` per deployed origin.
- **Commit + push with a clear message.** Never force-push or push to a shared `main`
  without flagging it.
- **Beads:** the project rule says track tasks in `bd`, but Dolt is not installed on this
  WSL2 box, so `bd` commands fail here. Skip until Dolt is available (do not block work on it).
- **`npm audit`:** the 5 reported vulns are all in the dev toolchain (esbuild→vite→vitest).
  The esbuild advisory only affects the local dev server; it is not in the production bundle.
  Not auto-fixed because `audit fix --force` pulls vite@8 (breaking). Revisit on a Vite major bump.

## Status
Sidebar shell shipped with four views: Dashboard, Cowork (bridge-file board), Architectures
(React Flow builder with manual toolbar + prompt), Fitness (ability ladders).

**Fitness is verified** — the previously-unobserved suite was run: `npm test` = 20 files /
158 tests pass, `npm run build` green. The ⚠️ on it is cleared.

The orchestrator now exists (`orchestrator/`), so `/architect` and `/run` are real rather than
stubbed. `/run` is verified end-to-end against the `claude` CLI, including with an architecture
attached as context; `GET|PUT /architectures` is verified by driving it (write, read back,
rename-prune, delete-prune, 400 on a bad body). **`/architect`'s Claude API call has still not
been run against live credentials** — it was built and reviewed against the current API
reference, and its routing, validation, error handling, CORS, and schema/coercion are tested,
but the first real prompt is unproven. Send one before trusting it — either against the live
deployment (which holds a real key) or locally, after putting a real key in
`orchestrator/.env`, where the committed value is the placeholder `sk-ant-...` and the server
says so at boot rather than failing later with a 401.

Architectures now persist to disk (see the runner seam above), which closes the "diagrams are
invisible to agents" blocker. Note the browser only writes there while the orchestrator is
running — the canvas badge reads **browser only** otherwise.

**It is deployed and live: `https://goldensyrupos-production.up.railway.app`.** One Railway
service (site + API), a Postgres beside it, `ANTHROPIC_API_KEY` / `OS_PASSWORD` /
`OS_SESSION_SECRET` / `DATABASE_URL` set on the app service.

Before the deploy the config was driven locally rather than reasoned about: the orchestrator
was booted with `PORT` set and every endpoint exercised (30 checks) — the no-password
interlock refuses to boot, the site and its built bundle are served, SPA fallback resolves
while API paths still win, every data/spend endpoint 401s without a cookie, wrong and empty
passwords are rejected, the session cookie is HttpOnly+SameSite=Lax, a forged cookie is
rejected, the architectures round-trip and prune, `/run` is off, and logout re-locks. The
Postgres backend was verified against a real database, **including a restart with the data
surviving** — the redeploy case it exists for. One bug fell out of this that no amount of
reading would have: the SPA fallback used `\b` as its API-path boundary, which also matches
before a hyphen, so `/architecture-notes` 404'd instead of loading the app. Fixed to a
`/`-or-end boundary.

**The live deployment was then re-verified from outside** (9 checks against the public URL):
`/health` 200; `/` serves the built site; `/architectures` and `/run` 401 without a cookie
(auth runs *before* `/run`'s hosted 501, so 401 is the unauthenticated answer); `/auth/status`
reports `{required:true,authed:false}`; a wrong password 401s with no `Set-Cookie`;
`/architecture-notes` returns the app, so the `\b` fix holds in production; and the shipped
bundle contains **zero** matches for `sk-ant` — the Anthropic key is not in the browser.
The boot log reads `architectures: postgres (postgres)`, which is the only proof that the
`DATABASE_URL` reference variable actually took.

One thing the deploy surfaced that is worth knowing: Railway passes service variables to
nixpacks as build args, so Docker warns `SecretsUsedInArgOrEnv` for `ANTHROPIC_API_KEY` and
friends, and they land in the image's ENV metadata. That is a platform behaviour, not
something this repo does, and it is *not* the browser bundle — `vite.config.ts` sets no
`envPrefix`, so only `VITE_`-prefixed vars are inlined (confirmed by the bundle scan above).
The image is private to the project; rotate the key if it ever leaves Railway.

Two traps for whoever wires this up next. **Do not add Railway's "Suggested Variables"** — it
scrapes `.env.example` and offers placeholder hosts (`intel.example.railway.app` and
friends) that would bake dead URLs into the bundle; `VITE_CONNECTOR_READ_TOKEN` is worse,
since a `VITE_` var is public to anyone with devtools. And **`railway.json` is only honoured
by deploys made after it existed** — an older deployment fell back to the nixpacks default
`npm start`, which is `vite preview`, quietly serving the static site with no API, no auth
and no Postgres. The tell is Vite's `→ Local:` banner in the deploy log where the
orchestrator's six boot lines should be.

Still unproven: the first live `/architect` prompt (unchanged — it needs real credentials
either way, and the hosted service now has them).

Next: that first live `/architect` prompt; connect the desktop Cowork folder to keep
`public/cowork-state.json` live; real job/trade data (seed has samples). The bigger open
direction: one prompt box that routes to Cowork / Claude Code / Claude chat — Code round-trips
today, an API-backed `/chat` is buildable but is not Sriram's claude.ai history, and Cowork
stays half-loop (the orchestrator can drop a task file in, but a human must open Cowork to act).
