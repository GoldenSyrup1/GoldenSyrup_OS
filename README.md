# 🍯 GoldenSyrup OS

Personal visual-first command centre — one dashboard over every GoldenSyrup project and life domain.

## Quick start
```bash
npm install
npm run dev      # http://localhost:5180
npm test         # run the test suite
npm run build    # typecheck + production build
```

## What's here
- **8 revolution pillars** with status, progress rings, and next actions.
- **Project dashboards** (WEPort, GoldenSyrup_Intel, Stall-In, claude_connector, …).
- **Relationship map** of contacts ↔ projects (React Flow).
- **Hackathons & milestones.**

Data is currently seeded from `src/data/seed.ts` (distilled from claude_connector memory).
Live adapters to the Railway backends are the next step.

See `CLAUDE.md` for architecture, conventions, and status.
