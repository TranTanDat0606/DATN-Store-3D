# STORE 3D — CMS Architecture Specification (W1.7)

**Status: SPECIFICATION ONLY.** No CMS model, controller, route, Admin page or
Storefront UI exists at the time of writing. Everything below is a design to be
implemented in W2–W7. Anything not marked "Implemented" is future work.

Companion to the release-gating infrastructure that *is* implemented
(`server/src/release/manifest.json`, `GET /api/release`, `requireFeature`).

---

## 1. Scope and non-goals

### In scope
Customer-managed content for a non-technical Vietnamese shop owner: homepage
sections, a banner carousel, site settings, header/footer navigation, a media
library, static pages and policies, and SEO fields — with draft/preview/publish,
version history, audit logging and role-based permissions.

### Explicitly out of scope
- **No unrestricted HTML or JavaScript editor.** Content authors compose from a
  fixed, whitelisted set of block types. There is no "custom code" block and no
  raw `<script>`/`<style>` input path anywhere in the CMS.
- No free-form page-builder layout (absolute positioning / CSS grid editing).
- No multi-language content (the site is Vietnamese-only).
- No headless delivery to third parties; the API serves this storefront only.

---

## 2. Feature keys and release gating

Every CMS capability is gated by a key already reserved in
`server/src/release/manifest.json`. Gating is **server-authoritative** and is
decided by the environment plus the version-controlled manifest — never by a
database setting — which is how "an Admin must never enable an unreleased
capability" (A-6) is enforced structurally.

| Capability | Feature key | Manifest `since` |
|---|---|---|
| Public banner carousel read | `banners` | 0.2.0 |
| Admin banner CRUD | `cms.banner` | 0.2.0 |
| Homepage sections (read) | `cms.section` | 0.7.0 |
| Admin page builder | `cms.section` | 0.7.0 |
| Site settings | `cms.settings` | 0.7.0 |
| Media library | `cms.media` | 0.7.0 |
| Static pages / policies | `cms.page` | 0.7.0 |
| Navigation & footer | `cms.nav` | 0.7.0 |

Rules:
- Every gated route mounts `requireFeature(key)` **in addition to**
  `requireAuth`/`requireAdmin`, never instead of them.
- Disabled features answer **404**, not 403, so unreleased work is not
  advertised (A-6).
- Auth infrastructure is never gated (R-R2).

---

## 3. Data model

All CMS collections carry `createdAt`/`updatedAt`, a `createdBy` (admin id) and
`updatedBy`, and live in the same MongoDB database as the existing collections.
No new database.

### 3.1 `SiteSetting` (singleton)
```ts
{
  key: 'site',                     // fixed, unique
  logoUrl: string, faviconUrl: string,
  brandName: string,               // default 'STORE 3D'
  contact: {
    phone: string | null,          // null = explicitly unconfigured (A-10)
    email: string | null,
    address: string | null,
    workingHours: string | null,
  },
  social: { facebook?, instagram?, tiktok?, youtube? },   // each string|null
  seoDefaults: { metaTitle, metaDescription, ogImageUrl },
  announcement: { text: string | null, link: string | null, enabled: boolean },
}
```
`contact` fields default to `null` and render as an "unconfigured" state in the
UI. Real contact data is operator-supplied and is **never** invented or seeded.

### 3.2 `BannerSlide`
```ts
{
  title: string,                   // 1..120 chars
  subtitle: string | null,         // 0..300
  imageUrl: string,                // required, must be a MediaAsset ref or https URL
  imageAlt: string,                // REQUIRED, 5..200 — a11y, validated
  href: string | null,             // internal path (/san-pham/...) or https URL
  ctaLabel: string | null,         // shown only when href is present
  position: number,                // integer, 0-based ordering, unique per status
  status: 'draft' | 'published' | 'archived',
  publishedAt: Date | null,
  scheduleFrom: Date | null, scheduleTo: Date | null,   // optional auto window
}
```
Validation: if `href` is present, `ctaLabel` is required and vice versa — so a
banner can never render a button with no destination (R-R1: every CTA must point
to a reachable, released destination).

### 3.3 `PageSection` (homepage sections)
```ts
{
  type: SectionType,               // see §6 whitelist — closed enum
  title: string | null,
  settings: Record<string, unknown>,   // validated per `type` by a zod discriminated union
  items: SectionItem[],            // references: product / category / news / banner / page
  position: number,
  visible: boolean,
  status: 'draft' | 'published',
}
```

### 3.4 `Page` (static pages & policies)
```ts
{
  slug: string,                    // unique, regex ^[a-z0-9-]+$, reserved words rejected
  title: string, excerpt: string | null,
  contentMarkdown: string,         // Markdown ONLY (A-5)
  status: 'draft' | 'published',
  publishedAt: Date | null,
  seo: { metaTitle: string | null, metaDescription: string | null, ogImageUrl: string | null, noindex: boolean },
  template: 'default' | 'policy',
}
```
Served at `/trang/:slug`.

### 3.5 `NavItem`
```ts
{ location: 'header' | 'footer', label: string, href: string,
  position: number, visible: boolean,
  opensInNewTab: boolean, children: ObjectId[] /* max depth 2 */ }
```

### 3.6 `MediaAsset`
```ts
{ url, publicId, filename, mimeType, width, height, sizeBytes,
  alt: string,           // REQUIRED — enforced at upload
  uploadedBy, createdAt }
```

### 3.7 `CmsRevision`
```ts
{ entityType: 'banner' | 'page' | 'section' | 'siteSetting' | 'nav',
  entityId: string, version: number,
  snapshot: object,        // full document as it was
  createdBy, createdAt, note: string | null }
```

### 3.8 `AuditLog`
```ts
{ actorId, actorRole, action: 'create'|'update'|'delete'|'publish'|'unpublish'|'rollback'|'upload'|'login',
  entityType, entityId, summary: string,
  before: object|null, after: object|null,   // stored only for mutations, never for reads
  ip, userAgent, createdAt }
```

---

## 4. API contracts

All admin endpoints require `requireAuth` + `requireAdmin` + the matching
`requireFeature`. All responses use the existing envelope
`{ success, message, data, pagination, errors }`.

### Public (read-only, gated by the *read* key)
| Method | Path | Notes |
|---|---|---|
| GET | `/api/banners` | published + within schedule window, ordered by `position` |
| GET | `/api/pages/:slug` | 404 for unpublished; honours `seo.noindex` |
| GET | `/api/site-settings` | public subset only (no internal fields) |
| GET | `/api/nav/:location` | visible items only, tree depth ≤ 2 |
| GET | `/api/home-sections` | visible + published, ordered |

### Admin (write)
| Method | Path | Feature |
|---|---|---|
| GET/POST | `/api/admin/banners` | `cms.banner` |
| GET/PUT/DELETE | `/api/admin/banners/:id` | `cms.banner` |
| POST | `/api/admin/banners/:id/publish` \| `/unpublish` | `cms.banner` |
| …same shape for `/pages`, `/sections`, `/nav`, `/site-settings`, `/media` | matching key |
| POST | `/api/admin/cms/:entity/:id/rollback` | `{ version }` |
| GET | `/api/admin/cms/:entity/:id/revisions` | paginated history |

### Preview (A-7)
`GET /api/admin/preview/:entity/:id` returns the **unpublished** draft payload.
It is admin-only; there is no public preview token and no shareable draft link.
The Storefront renders it only inside an admin session.

### Write-safety rules
- `PUT` accepts the full editable subset; unknown fields are rejected by zod
  (`.strict()`), so a client cannot smuggle `status: 'published'` through an
  update that was meant to be a draft edit.
- `position` reordering is applied in a single request as an ordered id list and
  is transactional per entity type.
- Deletes are soft (`archived`) for banners/pages; media deletion is refused
  while any reference points at it.

---

## 5. Rich-text policy (A-5)

Two rules, no exceptions:

1. **Existing `News.content` stays HTML.** It is rendered through
   `client/src/lib/sanitize.ts` (DOMPurify + explicit prose allowlist) inside
   `parseMarkdownToHtml`, the single HTML choke point. This is **implemented**
   in W1.1 and is covered by `client/src/lib/markdown.test.ts`.
2. **All new CMS rich text is Markdown** (`contentMarkdown`), stored raw and
   rendered through the same `parseMarkdownToHtml` → `sanitizeHtml` path.

There is no option to disable sanitizing, and `marked` is not used to bypass it
(`marked@18.0.11` has no `html` option and does not sanitize at all).

---

## 6. Whitelisted block types (A-8)

`SectionType` is a **closed enum**. Adding a type requires a code change, a
manifest/review, and a renderer — never a database value.

| type | Purpose | Allowed item refs |
|---|---|---|
| `hero` | Image-led hero (replaces the retired text-heavy hero) | `banner` |
| `banner_carousel` | Rotating banner slides | `banner` |
| `product_grid` | Product cards | `product` |
| `product_row` | Horizontal scroll row | `product` |
| `category_grid` | Category tiles | `category` |
| `news_grid` | Latest articles | `news` |
| `rich_text` | Markdown block | — |
| `image` | Single image with optional link | `media` |
| `cta_banner` | Full-width image + one CTA | `media` + `href` |
| `spacer` | Vertical spacing | — |

Each type has its own zod schema for `settings`, attached to a discriminated
union on `type`. A payload whose `type` is unknown is rejected at the API — the
renderer is never asked to draw something it does not recognise.

**Renderer contract.** `SECTION_RENDERERS[type]` must exist for every
`SectionType`. A missing renderer is a build-time error (exhaustive `Record`
typed against the union), not a runtime fallback that could render raw data.

### Retired homepage hero
The current text-heavy hero in `client/src/pages/home-page.tsx` is **removed
entirely** in W2 and is explicitly *not* an acceptable fallback. The replacement
is image-led (`hero` block referencing a `banner`), and its empty state is an
approved design (§11), not an error and not a leftover of the old hero.

---

## 7. Draft / preview / publish state machine

```
draft ──publish──> published ──unpublish──> draft
   │                    │
   └──archive──> archived <── (banners/pages only; reversible)
```
- `published` requires: `imageUrl`/`imageAlt` present, and every `href`
  resolving to a **released** destination (checked against the active feature
  set at publish time, R-R1).
- Unpublishing returns content to `draft`; it is not deleted.
- Publishing writes an `AuditLog` entry and a `CmsRevision`.

---

## 8. Revision retention (A-11)

- Every mutating action that changes stored content writes one `CmsRevision`.
- **Maximum 50 revisions per entity.** Retention is deterministic:
  after each write, versions are ordered descending and anything beyond the 50th
  is deleted — so an entity stabilises at exactly 50 and trimming does not depend
  on timing, batching or concurrency.
- `version` is a monotonically increasing integer per entity (not derived from
  the retained count), so rollback targets stay addressable after trimming.
- Rollback creates a **new** revision whose snapshot equals the target version —
  history is never rewritten.

---

## 9. Audit logging

- Every admin mutation writes one `AuditLog` row with actor, action, entity,
  and before/after snapshots.
- `GET /api/admin/audit` is `requireAdmin` + `cms.settings`, paginated and
  filterable by actor/entity/date. Read-only.
- Logs are append-only: no endpoint updates or deletes them.

---

## 10. Role-based permissions

Two roles only, matching the existing `UserRole` enum (`admin`, `customer`).
There is no new "content editor" role in this phase.

| Operation | customer | admin |
|---|---|---|
| Read published content | ✅ | ✅ |
| Preview drafts | ❌ | ✅ (A-7) |
| Create/update/publish | ❌ | ✅ |
| Rollback | ❌ | ✅ |
| Read audit log | ❌ | ✅ |

Enforcement is server-side only. The Admin UI hiding a button is convenience,
never the control. Combined with W1.3, a deactivated admin loses all of this
immediately, not at JWT expiry.

---

## 11. Empty and fallback states

Required, designed, and distinct from error states:

- **No banners published** → the homepage renders no carousel and no empty
  track; it falls through to the next section. It never renders the retired
  text-heavy hero.
- **No sections configured** → approved "chưa có nội dung" placeholder in the
  admin preview; the storefront omits the region entirely.
- **Media asset missing** → the existing deterministic SVG placeholder (W1 fix
  `fix/svg-placeholder-xml-escape`) is used, with `alt` preserved.
- **Draft page hit by URL** → 404 for the public, rendered for an admin session.

---

## 12. Migration strategy

- **No destructive migration.** Existing collections are untouched.
- New CMS collections are created empty and are **seeded only from existing
  source**, never invented:
  - `PageSection` is seeded to mirror the sections currently hard-coded in
    `home-page.tsx`, preserving the current visual order and product references.
  - `NavItem` is seeded from the current header/footer link lists in
    `navbar.tsx` / `footer.tsx`.
  - `SiteSetting.contact` is seeded as **`null`** (explicitly unconfigured, A-10).
  - `BannerSlide` starts **empty**; banners are content the owner supplies.
- `News.content` keeps its HTML. No conversion, no data rewrite.
- The seed script stays idempotent and matches the existing
  "insert only what is missing" behaviour, and **never** runs `--fresh`
  against a non-test database (the existing e2e guard already enforces this).
- Rollback of a release is done by turning the feature key off, not by reversing
  a migration — the data is additive.

---

## 13. Acceptance criteria / customer handover checklist

The CMS is accepted only when all of the following are demonstrable:

1. The shop owner can add, edit, reorder, publish and unpublish a banner —
   including its image, alt text, headline, CTA label and destination — without
   a developer, and the change is visible on the storefront.
2. The owner can enable, disable, reorder and edit every homepage section, and
   the retired text-heavy hero cannot be restored through the UI.
3. Every CTA rendered by the CMS points at a destination that exists **and** is
   released; publishing to an unreleased destination is blocked.
4. No input anywhere accepts or executes `<script>` or arbitrary HTML/JS; a
   payload entered into a rich-text field is stored inert and renders sanitized.
5. Draft, preview and publish work, and a draft is never publicly reachable.
6. Version history shows ≥ the last 50 states per object, and rollback restores
   a chosen version while keeping history intact.
7. Every admin mutation appears in the audit log with actor and before/after.
8. A deactivated admin loses CMS access immediately.
9. Turning a feature key off makes the corresponding route answer 404 for
   everyone, including admins.
10. Logo, brand name, contact details and social links are editable and the
    contact block renders an explicit "unconfigured" state until real data is
    entered.
11. Media uploads require alt text and reuse is tracked; deleting referenced
    media is refused.
12. Static pages and policies are editable with SEO fields, and `/trang/:slug`
    resolves.
13. All of the above work in Light and Dark themes, on desktop and mobile.
14. `GET /api/release` reflects exactly what is enabled, and there is no UI or
    API that can enable something the deployment has not released.

---

## 14. Deferred (explicitly not part of the minimum handover CMS)

Optional enhancements to schedule only after acceptance: scheduled publishing
beyond the banner window, per-section A/B variants, image focal-point editing,
revision diffing UI, an "editor" role, content translation hooks, and analytics
on section performance.
