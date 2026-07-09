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

## Runner seam (prompt → work)
`lib/runner.ts` (Command Console) and `lib/architect.ts` (Architectures) both split stub ⇄
orchestrator: a stub works with no infra/cost; when `VITE_OS_ORCHESTRATOR_BASE` is set they POST
to `/run` and `/architect` respectively. Keep new prompt surfaces on this pattern.

## Project structure
```
src/
  types.ts              shared domain types (incl. Cowork + Architecture types)
  data/seed.ts          seeded state from memory
  data/cowork.ts        Cowork bridge adapter (normalize + category rollup) — unit tested
  lib/util.ts           pure helpers (status color, progress aggregation) — unit tested
  lib/architecture.ts   architecture graph ops + React Flow projection — unit tested
  lib/architect.ts      prompt → graph patch (stub ⇄ orchestrator) — unit tested
  hooks/                useLiveData, useCommandConsole, useCowork, useArchitectures
  components/           ProgressRing, StatusDot, Card, Sidebar, CoworkBoard, ArchitectureCanvas, …
  views/                DashboardView, CoworkView, ArchitecturesView
  App.tsx               shell: sidebar + view switch
  test/setup.ts         jest-dom matchers
```

## Commands
- `npm run dev` — local dev server (port 5180).
- `npm test` — run the Vitest suite (run mode).
- `npm run build` — typecheck + production build.
- `npm run lint` — typecheck only.

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
Sidebar shell shipped with three views: Dashboard, Cowork (bridge-file board), Architectures
(React Flow builder with manual toolbar + prompt). Tests passing, production build green.
Next: connect the desktop Cowork folder to keep `public/cowork-state.json` live, and wire the
orchestrator `/architect` endpoint so architecture prompts generate real graphs (stub for now).
