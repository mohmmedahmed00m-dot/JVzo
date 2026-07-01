# Affiliate Launch Kit

Full-stack implementation of the **Affiliate Launch Kit Technical Blueprint** — a modular monolith backend (NestJS + PostgreSQL + Redis/BullMQ) and a React + TypeScript frontend that generates 5 affiliate marketing assets (Review Page, Bonus Page, Email Sequence, Social Posts, CTA) per campaign, with JWT auth, JVZoo license management, and ZIP export.

> Built strictly from `Affiliate_Launch_Kit_Technical_Blueprint.md` (the single source of truth). See `FINAL_REPORT.md` for the build log and any documented deviations.

---

## Tech Stack (Section 5)

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | NestJS 11 (modular monolith) |
| Database | PostgreSQL 17 (TypeORM) |
| Queue | Redis + BullMQ (export jobs) |
| AI Engine | Anthropic Claude API (with deterministic local mock fallback) |
| Auth | JWT (access 15m + refresh 7d httpOnly cookie) + bcrypt(12) |

---

## Quick Start

### One-command dev bootstrap (installs Postgres + Redis + deps, migrates, seeds)

```bash
cd affiliate-launch-kit
bash dev-up.sh
```

### Run the stack

```bash
# Terminal 1 — backend (port 3000)
cd backend && npm run start:dev

# Terminal 2 — frontend (port 5173, proxies /api -> 3000)
cd frontend && npm run dev
```

Open http://localhost:5173

### Default test credentials

- **Test license key:** `ALK-DEMO-TEST-0001-0001` (seeded, active)
- Register any email/password (≥8 chars), then activate the license key above.

---

## Project Structure (Section 10)

```
/affiliate-launch-kit
├── backend/
│   ├── src/
│   │   ├── modules/{auth,campaigns,generators/{review,bonus,email-sequence,social-posts,cta},export,licensing,notifications}
│   │   ├── common/   (guards, filters, decorators)
│   │   ├── config/   (env loader/validation)
│   │   ├── database/ (entities, migrations, seed)
│   │   └── main.ts
│   ├── test/         (e2e-flow.js, audit.js)
│   └── .env.example
├── frontend/
│   └── src/{pages,components,features,hooks,lib,styles}
├── dev-up.sh         (cold-start bootstrap)
└── FINAL_REPORT.md
```

## Environment (Section 9)

Copy `backend/.env.example` → `backend/.env`. The shipped `.env` contains **fake placeholder values** so the system runs end-to-end without real keys. The AI Engine auto-detects a placeholder/absent `ANTHROPIC_API_KEY` and uses a deterministic local generator; S3 export falls back to local filesystem; email notifications log to console. Replace with real credentials for production.

## Testing

```bash
# 1) Backend E2E (API flow: register→license→campaign→5 assets→edit→export→download→JVZoo IPN)
cd backend && bash run-e2e.sh            # 23 checks

# 2) Security audit (bcrypt, HTML sanitizer, license revocation)
cd backend && bash run-audit.sh          # 11 checks

# 3) REAL BROWSER E2E — Chromium + Playwright simulates an actual user
#    across all 5 screens, with real screenshots + responsive + network-failure
bash e2e/run-browser-e2e.sh              # 25 checks + screenshots in e2e/screenshots/

# 4) RESPONSIVE E2E — verifies adaptation across 8 device widths (320px→1920px)
#    with zero horizontal overflow, screenshots in e2e/screenshots/responsive/
bash e2e/run-responsive.sh               # 56 checks across 8 devices

# Full cold verification (all of the above in one command)
bash final-verify.sh
```

All four layers are green: **23 + 11 + 25 + 56 = 115 live checks PASS**.

## Responsiveness

The UI is mobile-first and adapts from the smallest phone (320px) to ultra-wide monitors (1920px), verified across 8 real device viewports with Chromium:

- **Phones (320–480px):** slide-in sidebar drawer (hamburger), single-column layouts, Edit/Preview pane toggle in the editor, horizontally-scrollable tables.
- **Tablets/Desktops (768px+):** persistent sidebar, dual-pane editor, multi-column grids.
- **Fluid typography** via `clamp()` so text scales smoothly (no jumps), `100dvh` for correct mobile browser-chrome handling, 44px minimum touch targets, `prefers-reduced-motion` and print support.
