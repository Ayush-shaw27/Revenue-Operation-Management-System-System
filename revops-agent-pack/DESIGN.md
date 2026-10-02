# DESIGN.md — RevOps Pro UI Rules

Source of truth for tokens: `frontend/src/index.css` (CSS variables on `.theme-dark` / `.theme-light`). Never hardcode colors in components — use `var(--token)`.

## 1. Principles

1. **Looks like a real product.** No demo banners, no prefilled credentials, no invented KPIs. Marketing visuals that show numbers must be labelled *illustrative* or bound to the API.
2. **Both themes finished.** Light is a separate token set tuned for light backgrounds — test every screen in both.
3. **Motion has meaning.** Entrance = orientation, hover = affordance, cursor effects = delight. Never block content behind an animation.
4. **Content is never invisible.** If CSS/JS animation fails, content must still be readable (no permanent `opacity-0` without a working animation).
5. **Data first.** Every card has loading (Skeleton), empty (EmptyState), and error (ErrorState) states.

## 2. Tokens

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#080a19` | `#f4f6fb` |
| `--bg-secondary` | `#0b0e1f` | `#eef1f8` |
| `--text-primary` | `#f2f4f8` | `#10142a` |
| `--text-secondary` | `#a8b0c3` | `#4a5268` |
| `--text-tertiary` | `#6b7286` | `#8a91a8` |
| `--accent` | `#06b6d4` (cyan) | `#0891b2` |
| `--border` | `rgba(255,255,255,.08)` | `rgba(16,20,42,.10)` |
| `--glass-bg` / blur | `rgba(17,16,15,.35)` / 20px | `rgba(255,255,255,.62)` / 14px |
| Secondary hue | violet `#8b5cf6` (atmosphere gradients) | same at lower alpha |

Semantic colors: success = emerald, warning = amber, danger = rose, info = accent. Score/tier badges use `Badge` variants (`StageBadge`, `TierBadge`, `ScoreBadge`).

## 3. Type & spacing

- Font: **Inter Variable** via `next/font/local` (`app/fonts/InterVariable-latin.woff2`), exposed as `--font-inter`.
- Scale: 11/12/13/14/16/20/28/46/72 px. Dashboard body 14px; page titles 20–28px; hero 52–72px.
- Radius: cards 22px, controls 12px, chips 6–8px. Spacing on a 4px grid.
- Layout: sidebar 248px (72px collapsed on small screens), content `px-4 sm:px-6 py-6`, max content width fluid.

## 4. Surfaces

- `.glass-card` (blur + border) for primary panels; `.glass-card-subtle` for dense lists; `.glass-card-elevated` for modals/menus.
- Hover: border → `--border-strong`, soft shadow, `translateY(-2px)` max.
- Reuse `components/ui/*` (`GlassCard`, `StatCard`, `Button`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`, `AnimatedNumber`). Don't create parallel variants.

## 5. Motion

- Library: **Framer Motion 11.11.17**. Shared config in `src/lib/motion.ts`: `EASE = [0.16, 1, 0.3, 1]`, `DURATIONS {fast .2, standard .4, slow .7, page .5}`, `STAGGER` container/item.
- Page transition: fade + 12px rise (in `DashboardLayout`). Lists/cards stagger 0.08s.
- Numbers count up (`AnimatedNumber`). Charts animate once on mount.
- **Cursor-reactive layer:** `CustomCursor` / `CursorTracker` (built, currently not mounted). Mount on marketing + login only, `pointer: fine` devices only, with magnetic hover on primary buttons and a soft spotlight following the cursor on hero/cards. Keep the native cursor on dashboard data tables.
- Scroll effects on the public site: section reveal (`whileInView`, `once`), parallax on background orbs, sticky nav that gains blur after 24px scroll.
- **Reduced motion:** honor `prefers-reduced-motion` (CSS block in `index.css` + `useReducedMotion` in `lib/motion.ts`). Cursor effects off.
- Budget: no animation >900ms; nothing loops infinitely except skeleton shimmer and ambient background orbs.

## 6. Charts (Chart.js via react-chartjs-2)

- Components in `components/charts/` (`AreaChart`, `BarChart`) — extend, don't add another chart library.
- Read colors from CSS variables at render so they follow the theme. Gridlines `--border`, ticks `--text-tertiary`.
- Always show units and period; tooltips formatted via `lib/format.ts`; forecast = dashed line + shaded confidence band; actual = solid.
- Show metric provenance for ML charts (model name, holdout metric). Never show a bare "accuracy %".

## 7. Public site (multi-page, not a single hero)

Required pages: `/` (hero + product story), `/platform` (feature deep-dives), `/pricing`, `/resources` (or `/blog`), `/about`, `/contact` (demo request), `/login`. Shared `Nav` + `Footer`; nav links must route to real pages (no `href="#"`, no dead spans).
Each page: scroll-reveal sections, one interactive visual, consistent CTA → `/login` or `/contact`. Illustrative dashboards use sample data labelled as such.

## 8. Auth screens

- No prefilled or placeholder credentials that hint at real accounts (`you@company.com` / dots only).
- Inline error under the form on 401 ("Incorrect email or password"); disable button + spinner while pending; show/hide password toggle; correct `autoComplete`.
- Backend-unreachable state is distinct from bad credentials ("Can't reach the server").

## 9. Accessibility (WCAG 2.1 AA)

- Text contrast ≥4.5:1 in both themes (check `--text-tertiary` on `--bg`).
- Visible focus ring on every interactive element (accent, 2px). Full keyboard path: Sidebar → TopBar → content; `⌘/Ctrl+K` opens `CommandPalette`; `Esc` closes overlays.
- Icon-only buttons need `aria-label`; charts need a text summary or table fallback; status is never color-only.
- Touch targets ≥44px on mobile; mobile nav drawer traps focus.

## 10. Definition of "design done" for a page

Renders in dark + light · loading/empty/error states · keyboard usable · no console errors · no hardcoded numbers · matches token table · animation optional (content visible with motion disabled).
