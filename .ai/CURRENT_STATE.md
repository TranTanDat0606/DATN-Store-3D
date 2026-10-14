# Store3D — Current State

> Last updated: 2026-10-14 (Gate W2.2 — test foundation on branch `test/foundation-w2.2`, awaiting review)

## Current Project Status

**Stable and working.** Fully functional Vietnamese e-commerce store for 3D-printed models. Client + API on Vercel, server on Render.

**Source control & delivery (verified 2026-10-13):** canonical repo `https://github.com/TranTanDat0606/DATN-Store-3D` (public, default `main`). Branches: `main` (production, auto-deploys via Vercel), `develop` (integration, PR target), `demo` (showcase). GitHub Actions CI (2 required checks) + 3 active rulesets. Production `main`=`03f68e3` → `dpl_8nAZUu4b3sihQbm3crzJfT3SernW` → `https://store3d-rosy.vercel.app/`. Legacy repo `store3D` frozen. Full facts in `.ai/CANONICAL_CONTEXT.md` §8.

## Implemented Features

### Fully Implemented
- **Product catalog:** List, search, filter by category, sort, pagination, featured products, related products
- **Product detail:** Immersive gallery-first layout with lightbox (double-click zoom, keyboard nav), desktop sticky purchase panel, mobile fixed bottom bar, tabbed content (Mô tả / Thông số / Đánh giá), rating summary bar chart, review cards, related products
- **Shopping cart:** Add/remove/update quantity, persisted to localStorage, cart drawer UI
- **Checkout:** Shipping info form, payment method selection (cash on delivery / bank transfer), coupon application
- **QR payment:** VietQR code generation with countdown timer, bank info display, copy-to-clipboard
- **Order management:** Create order (atomic stock decrement), order history, order detail, cancel order
- **User authentication:** Register, login, logout, profile update, password change (JWT httpOnly cookies)
- **Wishlist:** Add/remove products, move to cart, server-side persistence
- **Review system:** Purchase-gated reviews (must have completed order), CRUD, rating aggregation
- **Admin dashboard:** KPI cards (revenue, orders, products, customers), revenue charts (Recharts)
- **Admin products:** CRUD with Cloudinary image upload, stock management, status toggle
- **Admin categories:** CRUD with product count, deletion protection
- **Admin orders:** List with status filter, status workflow (pending → confirmed → shipping → completed)
- **Admin coupons:** CRUD (percent/fixed), min order, expiry, usage tracking
- **Admin reviews:** List, delete
- **Admin users:** List, role update, activate/deactivate, delete (protects last admin)
- **Admin Excel export:** 4-sheet XLSX (overview, daily revenue, monthly revenue, product sales with stock), excludes cancelled orders
- **News/blog:** Full CRUD (admin), public listing by category, slug-based detail pages
- **Contact form:** Submit, admin list/status/note management
- **Dark/light theme:** Toggle with localStorage persistence, smooth CSS transitions
- **Search with suggestions:** Horizontal scrollable product cards with images
- **Responsive design:** Mobile-first with drawer navigation, responsive grids
- **Image upload:** Cloudinary integration with 5MB limit, memory storage
- **Rate limiting:** Global (300/15min) and auth-specific (20/15min)
- **Error handling:** Central error handler, Vietnamese error messages
- **Database seeding:** Idempotent seed script with sample data
- **Mini-game (MIU-9 Future Run):** Canvas-based endless runner (1280×720, DPR-aware). Kill-only scoring (no distance points). 3-heart lives system with 2s invincibility frames on damage. Player: Pink cyber cat with arm cannon. Enemies: ground robot (+2 pts), bird robot (+4 pts, flies at jump height, fires red laser every 3s), mouse sword robot (+2 pts, charge/dash with "!" warning at 60% screen width). Controls: W/Space=Jump, S=Duck, F=Straight Laser, A/D disabled. Three game phases: idle→running→gameover. Keyboard input via window keydown/keyup with phase guard. Mobile touch controls (Jump/Duck/Fire). Cyberpunk start screen with enemy previews and kill-only scoring guide. HUD with score + hearts display. Game over overlay with score/best. Gemini integration: server endpoint generates game assets (background, road, player, bird-robot, mouse-robot) via @google/genai + Imagen 3. Client-side asset caching with 24h TTL. Canvas-drawn fallbacks when images unavailable. Admin test mode: admins can start unlimited test games without order requirement via /api/rewards/game/test-start. User play limit: 1 play per completed order (enforced server-side via GameSession unique index).
- **AI chat:** Mock provider (ai/test MockLanguageModelV4), per-user/guest localStorage scoping, debounced streaming persistence (500ms), product recommendation cards from markdown, 20-message server limit, MAX_MESSAGES=18 client guard
- **Product Gallery:** Dedup to show 2 unique Unsplash images per product (thumbnail + main image switching)
- **Checkout address (User):** User.address (profile string) used as default shipping address via synthetic entry; inline edit via profile API; __user_address__ sentinel never sent as addressId
- **Checkout address (Admin):** Address model entries with structured province/district/ward/street; existing behavior preserved
- **Profile email:** Editable email input with Zod validation; backend uniqueness check (409 on duplicate); persists after reload
- **Favorites:** Fixed price/button overlap — pb-12 padding when hideAddToCart prop is true
- **Order creation:** Backend validates address ownership when addressId provided; User.address string used directly when no addressId

### Partially Implemented
- **Email/SMTP:** Config exists in env vars but no email sending code is implemented
- **Payment webhook:** Endpoint exists but relies on external webhook configuration

## Chat History Persistence (verified 2026-08-31)

### Guest users
- History scoped by stable guest session ID (`store3d_guest_xxx` stored in localStorage)
- Survives F5/page refresh
- Different browsers get different guest IDs

### Authenticated users
- History scoped by user ID (`store3d_chat_{userId}`)
- User A never sees User B's history
- Login/logout transitions: `storageKeyRef` updates immediately, `chatId` recomputes via `useMemo`

### Streaming persistence
- Debounced save at 500ms during streaming (not every token)
- `beforeunload` handler flushes pending saves
- Cleanup on component unmount
- `onFinish` does immediate final save (overwrites debounced partial)
- `clearChat` cancels pending saves before clearing

### History size
- Client: MAX_MESSAGES = 18 (kept in localStorage)
- Server: max 20 messages validated by Zod schema
- Older messages trimmed from localStorage on save

## AI Token/Tool Optimization Rules (verified 2026-08-31)

All 10 rules verified in `aiChatService.ts`:
1. **Greeting** → direct response, no DB query
2. **Budget request** → parse budget, targeted product query
3. **No matching product** → fallback to nearest-price products
4. **General conversation** → no DB query
5. **Product-specific** → targeted query
6. **No guessing** → uses actual DB data
7. **Context minimization** → only selects name/slug/salePrice/originalPrice/images
8. **No double tool calls** → parseBudget in mutually exclusive branches
9. **Mock mode preserved** → `config.ai.provider === 'mock'`
10. **Security** → no secrets exposed

## Known Bugs / Issues

- **No critical bugs.** Application is stable. (Known HIGH/MED security debts tracked separately below — not user-facing bugs.)
- Demo credentials: sanitized baseline seed uses `CHANGE_ME_DEMO_PASSWORD` placeholder (no real credential committed). Confirm before final public docs.
- `store3d-rosy.vercel.app` (production) verified working. Legacy `store3d.vercel.app` custom-domain note retained as low-priority (not re-verified post-migration).
- News page card heights now equalized via flex layout fix
- Address Book page removed — address management consolidated into Checkout inline edit

## Vercel Deployment — Module Format Fix (verified 2026-08-31)

### Root Cause (confirmed from Vercel runtime logs)
`ReferenceError: exports is not defined in ES module scope` at `api/server.js:2:23`.

- Root `package.json` has `"type": "module"` → Node.js treats `.js` files as ESM by default
- `api/tsconfig.json` has `"module": "CommonJS"` → Vercel compiles `api/server.ts` to CJS (`exports` keyword)
- CJS output loaded as ESM by Node.js → `exports is not defined` crash at line 2, before any handler executes

### Fix Applied
1. **`api/package.json`** (created): `{"type": "commonjs"}` — makes Node.js resolve nearest package boundary for `api/server.js` as CJS
2. **`api/tsconfig.json`**: Kept `"module": "CommonJS"` intentionally — CJS ensures `require()` resolves extensionless relative imports to `../server/src/*` files correctly
3. **`server/src/services/aiChatService.ts`**: Changed static `import from 'ai'` / `import from 'ai/test'` to dynamic `await import('ai')` / `await import('ai/test')` — the `ai` package is ESM-only and cannot be `require()`'d from CJS
4. **`server/src/services/productService.ts`**: Replaced `require('mongoose').Types.ObjectId` with `mongoose.Types.ObjectId` (already imported at top)

### Why Not ESM Output
Changing `api/tsconfig.json` to `"module": "ES2022"` produces ESM output, but ESM requires explicit `.js` extensions in relative imports (`from '../server/src/vercel-connect'`). All server source files would need `.js` extensions added to imports. CJS approach avoids this by letting `require()` resolve extensionless paths natively.

### Verified
- Production endpoints all return correct responses (200 for data, 401 for unauthenticated `/api/auth/me`)
- `/api/health` → 200, `/api/auth/me` → 401, `/api/products` → 200, `/api/products/featured` → 200, `/api/categories/all` → 200

## Known Technical Debt

### Tooling / Process
1. **No client-side tests.** Zero test files in `client/`. No vitest/jest configuration
2. **Limited server tests.** 4 unit-test files only (`vietQr`, `seedCredentials`, `payment`, `orderStatus`) via `node:test`; no route/controller/service tests for order, cart, checkout, or auth flows
3. **No root README.md**
4. **CORS permissive in development** (`*` when `NODE_ENV !== 'production'`)
5. **No request logging** (no morgan)
6. **No API documentation** (no Swagger/OpenAPI)
7. ~~No CI/CD pipeline~~ **RESOLVED 2026-10-13** — GitHub Actions CI active (2 required checks) + 3 branch-protection rulesets. Production auto-deploys via Vercel on push to `main`.
8. **No environment validation** beyond MONGODB_URI and JWT_SECRET
9. **TypeScript strict mode not enabled** in server
10. **No database migrations** (Mongoose schemaless)
11. **GitNexus has no indexed repo** — MCP installed but `gitnexus://repos` is empty; fall back to Grep/Glob until indexed.
12. **Playwright MCP may be unavailable in-session** — configured globally but not always loaded; `test-*.spec.ts` at repo root have no `playwright.config.ts` and are not a working e2e suite.
13. **Deep links 404 in production** — `vercel.json` rewrites only `/api/*`, no SPA fallback; hard refresh of any client route (incl. `/dang-nhap`, `/admin`) 404s.

### Security (audit 2026-10-13 — line refs from audit digests; re-verify file:line at fix time. No source changed in Gate A1.)
- **Webhook signature is env-gated (fail-open).** `paymentController.ts` skips HMAC verification when `PAYMENT_WEBHOOK_SECRET` is unset; route does not mount raw-body middleware. HIGH.
- **Order price trusted from client.** `orderController.ts` reads `price`/`priceDiscounted` from `req.body`; server recompute (`recalculateTotals`) exists but is never triggered. HIGH.
- **Auth middleware defects.** `auth.ts`: async JWT verify not awaited/caught (invalid token → unhandled rejection, no 401); `active` flag never re-checked after verify (banned admin stays active until token expiry). HIGH.
- **No DB transaction on order creation.** `orderService.ts` writes Order+OrderItem+Payment+coupon without session; admin-cancel does not restore coupon usage. MED.
- **Public AI endpoints accept free-form payloads.** `schemas/gemini.ts`, `schemas/aiChat.ts` have no Zod object (rate-limited only). MED.

### UI / Frontend (audit 2026-10-13)
- **God components:** `ProductDetailPage.tsx` (~281 lines, 10 `useState`, effect-driven variant fetch) and `CheckoutPage.tsx` (~755 lines, inline payment logic).
- **Layout composition:** `Header`/`Footer` hardcoded in `App.tsx`; layout swaps page component instead of rendering `<Outlet>` → full-layout remount + scroll reset on navigation.
- **State over-render:** `CartContext` dispatches full-array `SET` on every mutation → redundant localStorage writes + full-provider re-render.
- **Duplicated logic:** filter/sort query-param parsing duplicated between `ProductsPage` and `SearchResultsPage`.
- **Token drift:** ~26 hardcoded hex colors + ~25 inline styles outside the Tailwind `@theme` tokens.
- **A11y:** duplicate `h1` on product detail; modals/lightbox lack focus trap and Escape handling; quantity input missing `inputMode="numeric"`.
- **Missing states:** checkout lacks a loading state; login/register lack a submit spinner.

## Test Foundation (Gate W2.2 — verified 2026-10-14, branch `test/foundation-w2.2` @ `73c3a84`, unmerged)

- **Component tests:** Vitest 5 + RTL 16 + MSW 2.15 (HTTP boundary, `msw/node` `setupServer`) + jsdom + vitest-axe (with manual `expect.extend` + `Assertion` type augmentation — package ships an empty `dist/extend-expect.js`). Real provider chain (`ThemeProvider→AuthProvider→CartProvider→wishlist→MemoryRouter`), deterministic fixtures, shared watch/report helpers. **20 tests / 4 files green** (product-card, product-list-page, cart-drawer, navbar) incl. scoped-rule a11y runs.
- **E2E smoke (read-only):** Playwright, 7 specs — home, category nav, listing→PDP, news, theme toggle+persistence, responsive 390/768/1280, API routing + cookie behavior (health, CORS credentialed fetch, readable `/auth/me` 401). Local test topology: API `127.0.0.1:5005` + client `vite preview --host 127.0.0.1:3108` cross-origin (baked `VITE_API_URL` via `build:e2e` + `client/.env.e2e`, no proxy reliance). **17 passed** (3 mobile checks annotated expected-fail, see W2.2-4). No order/payment/webhook flows.
- **DB isolation:** fail-closed guard `scripts/e2e-guard.mjs` (rejects non-loopback / non-`_e2e|_test` URLs before any DB work) + `scripts/e2e-start.mjs` runner that owns a disposable mongodb-memory-server DB, runs `seed --fresh` only against that DB, overrides JWT/payment/seed secrets with committed fixtures (never production creds). **8/8 node:test negative tests** incl. refusal exit-1. Memory server uses **wiredTiger** — the default `ephemeralForTest` engine wedges mid-run on this Windows host (mongod stops servicing established + new connections; observed seed hangs).
- **Verification:** client vitest 20/20, client lint exit 0, `tsc -b && vite build` exit 0, server node:test 19/19, guard 8/8, Playwright 17 passed. CI job names / branch protection / root legacy test specs untouched.

### Findings (pre-existing, NOT fixed in this gate)
- **W2.2-1:** `cart-drawer.tsx` uses `<aside role="dialog">` → axe `aria-allowed-role`. Fix in Gate B4.
- **W2.2-2:** sort Select trigger (Radix combobox) lacks an accessible name → axe `button-name`. Fix in Gate B3.
- **W2.2-3:** listing page's first heading is an `h3` → axe `heading-order`. Fix in Gate B3.
- **W2.2-4:** navbar right-side action cluster overflows the viewport by **34px at 390px** on every route (probed `/`, `/san-pham`, `/tin-tuc`). Desktop 1280 / tablet 768 clean. Responsive 390 checks annotated `test.fail()` (self-expiring). Fix in Gate B1 shell redesign.

## Database Seed Data

Demo accounts:
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@store3d.com | CHANGE_ME_DEMO_PASSWORD |
| Customer | khach@store3d.com | CHANGE_ME_DEMO_PASSWORD |
