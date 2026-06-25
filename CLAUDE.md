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

## Project structure
```
src/
  types.ts              shared domain types
  data/seed.ts          seeded state from memory
  lib/util.ts           pure helpers (status color, progress aggregation) — unit tested
  components/           ProgressRing, StatusDot, Card, PillarGrid, ProjectGrid, RelationshipMap
  App.tsx               dashboard composition
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
Scaffold complete: structure, seeded dashboards, tests passing, production build green.
Next: wire live data adapters (Intel signal + connector memory) behind the seed layer.
