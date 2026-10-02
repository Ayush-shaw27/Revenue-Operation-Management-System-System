# Changelog

All notable changes to RevOps Pro are documented here.

## [1.0.1] - 2026-09-15

### Fixed (Phase 1 & Phase 2)
- Changed backend host binding default in `app/main.py` from `0.0.0.0` to `127.0.0.1` (configurable via `HOST` env var).
- Added `GET /` root endpoint returning application metadata and route paths.
- Added `GET /health` route alias forwarding to `/api/health`.
- Added startup banner logging clickable local URLs (`http://127.0.0.1:8000/docs`, `http://127.0.0.1:8000/api/health`).
- Pinned `scikit-learn==1.9.0` in `requirements.txt` to eliminate `InconsistentVersionWarning` on joblib model deserialization.
- Added CLI user management script `backend/scripts/create_user.py` supporting password creation/reset and random strong password generation.
- Added active admin credential check on backend startup with guidance line if missing.
- Verified end-to-end authentication flow (`/api/auth/login`, `/api/auth/me`, `/api/leads` bearer protection).
- Created `frontend/.env.local` configured with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` and added `BackendConnectionBadge` indicator.
- Replaced remote CloudFront `.mp4` video in `Hero.tsx` with a CSS animated ambient gradient background.
- Migrated `next.config.js` from `images.domains` to `images.remotePatterns`.
- Pinned `framer-motion` to `11.11.17` for clean compatibility with React 18.3.1 and Next.js 15.2.4.
- Added cross-platform one-command startup scripts (`scripts/start-dev.ps1` and `scripts/start-dev.sh`).
- Untracked all `.pyc` and `__pycache__` artifacts from git and updated `.gitignore`.
- Rewrote `README.md` with complete 5-minute setup, CLI user creation guide, exact access URLs, and troubleshooting section.

## [0.3.0] - 2026-09-13

### Added
- **Accounts page** (`/dashboard/accounts`) — customer account list with health scores, search, filter, and CSV export
- **Analytics page** (`/dashboard/analytics`) — revenue trends, funnel by source/stage, cohort conversion table, and forecast scenario simulator
- Navigation entries for Accounts and Analytics in Sidebar and Command Palette
- `ForecastScenarioResponse` type and `forecastScenario()` API method
- `frontend/.env.example` with `NEXT_PUBLIC_API_URL`

### Changed
- Renamed all branding from "Apogee" to "RevOps Pro" across layout, nav, login, and README

## [0.2.0] - 2026-09-12

### Added
- ML-powered forecast page with Ridge/Linear/Gradient Boosting model selection
- Pipeline page with deal cards, anomaly indicators, and next-best-action suggestions
- AI Copilot chat page
- Alerts and Notifications pages
- Admin dashboard with system stats and model registry
- Dark glassmorphism UI kit (GlassCard, StatCard, Badge, Skeleton, EmptyState, ErrorState)
- AreaChart and BarChart components (Chart.js)
- Command Palette (Cmd+K) with page search and quick actions
- Sidebar with role-based navigation

## [0.1.0] - 2026-09-11

### Added
- FastAPI backend with auth, CRM, ML prediction, analytics, and copilot endpoints
- Frontend Next.js shell with auth context, API client, and routing
- Pytest suite (24 passing tests)
