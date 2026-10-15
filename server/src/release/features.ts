import manifest from './manifest.json';

/**
 * Release gating (W1.4).
 *
 * Two independent inputs, deliberately kept separate:
 *   1. `manifest.json` — the catalogue of feature keys that EXIST in source.
 *      Version-controlled, reviewed like any other code.
 *   2. `RELEASE_FEATURES` — which of those keys a DEPLOYMENT turns on.
 *
 * Enforcement model (review fixes F1/F2):
 *   - keys with wired routes (`catalog`, `news`, `account`, `auth.register`)
 *     are enforced by requireFeature() on the routers listed in
 *     PRODUCTION_FALLBACK's doc comment;
 *   - keys with no gated route yet (`banners`, `cms.*`) are reported by
 *     GET /api/release and stay OFF in production until a deployment names
 *     them — W2+ routes must mount requireFeature(key) when they land.
 *     `cms.*` describes FUTURE CMS capabilities (media library, pages,
 *     navigation, ...), not endpoints that already exist: the long-standing
 *     `/api/upload` admin image upload is shared infrastructure used by live
 *     catalog/news admin flows, is intentionally NOT gated by `cms.media`,
 *     and keeps working under requireAuth/requireAdmin alone;
 *   - when RELEASE_FEATURES is unset, production keeps serving exactly the
 *     capabilities that already serve traffic today (see PRODUCTION_FALLBACK).
 *     Boot validation rejects only structurally invalid switches — "all" in
 *     production, unknown keys, or a manifest missing a fallback key. An
 *     explicit list that merely OMITS a live key is accepted and replaces
 *     the fallback wholesale; that foot-gun is documented in
 *     .ai/ARCHITECTURE.md rather than blocked by validation.
 *
 * There is no database-backed toggle and no write endpoint on purpose: an
 * Admin setting must never be able to switch on a capability that has not
 * been released (A-6, A-12).
 *
 * Feature gating is a release-visibility control, NOT a security boundary.
 * It never substitutes for requireAuth/requireAdmin, and the auth
 * infrastructure is never gated by a feature key (R-R2): only the register
 * route carries a gate, login/profile/me/health never do.
 */

export interface FeatureDefinition {
  since: string;
  title: string;
  description: string;
}

export interface ReleaseManifest {
  schemaVersion: number;
  release: string;
  description?: string;
  features: Record<string, FeatureDefinition>;
}

/** Misconfiguration. Fail-closed: never silently enable or ignore in production. */
export class ReleaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReleaseConfigError';
  }
}

const SEMVER = /^\d+\.\d+\.\d+$/;

export const RELEASE_MANIFEST = manifest as ReleaseManifest;

/** Deployment switch. Comma-separated keys, or the literal `all`. */
export const RELEASE_FEATURES_ENV = 'RELEASE_FEATURES';

/**
 * Production default when RELEASE_FEATURES is unset (fail-closed).
 *
 * Two halves, deliberately:
 *  - foundation, auth.login, auth.register, catalog, news, account: these
 *    keys have LIVE routes serving production traffic today. A deployment
 *    that configures nothing must keep serving them — an unset switch may
 *    never 404 the storefront (preserving existing functionality).
 *  - everything NOT listed here — banners, cms.* — has no gated route yet and
 *    stays OFF in production until a deployment names it explicitly.
 *    That is the fail-closed property: NEW capabilities default to off.
 *    (Existing `/api/upload` is shared admin infrastructure, not a
 *    `cms.media` route — see the module header.)
 *
 * Note: `manifest.features[].since` records the plan's redesign release
 * milestones (catalog 0.2.0, news 0.3.0, ...), which is a different question
 * from "is this route already serving production?" — this fallback answers
 * the latter. requireFeature() is wired to product/category/news/address/
 * wishlist routers and the register route so the two inputs cannot disagree
 * with what the API actually enforces (review fix F1).
 */
export const PRODUCTION_FALLBACK = [
  'foundation',
  'auth.login',
  'auth.register',
  'catalog',
  'news',
  'account',
] as const;

// Fail fast at boot: a malformed manifest — including one that does not
// declare every key the production fallback references — must stop the
// process rather than silently disabling a live capability in production.
validateManifest(RELEASE_MANIFEST);

export const FEATURE_KEYS: readonly string[] = Object.keys(RELEASE_MANIFEST.features);

/** Structural validation of the manifest itself. Runs once at module load. */
export function validateManifest(m: ReleaseManifest): void {
  if (m.schemaVersion !== 1) {
    throw new ReleaseConfigError(`Unsupported release manifest schemaVersion: ${m.schemaVersion}`);
  }
  if (!SEMVER.test(m.release)) {
    throw new ReleaseConfigError(`Release manifest has an invalid release version: ${m.release}`);
  }
  const keys = Object.keys(m.features);
  if (keys.length === 0) {
    throw new ReleaseConfigError('Release manifest declares no features');
  }
  for (const key of keys) {
    const feature = m.features[key];
    if (!feature.since || !SEMVER.test(feature.since)) {
      throw new ReleaseConfigError(`Feature "${key}" has an invalid "since" version: ${feature.since}`);
    }
  }
  if (!('foundation' in m.features)) {
    throw new ReleaseConfigError('Release manifest must declare the "foundation" feature');
  }
  // Every key the production fallback turns on must exist in the manifest,
  // otherwise production would enable a feature nothing implements (or worse,
  // silently lose one when the manifest drops it). Review fix F3.
  for (const key of PRODUCTION_FALLBACK) {
    if (!(key in m.features)) {
      throw new ReleaseConfigError(
        `production fallback key "${key}" is not declared in the release manifest`,
      );
    }
  }
}

function isProduction(env: string): boolean {
  return env === 'production';
}

/**
 * Resolves the enabled feature set from a raw `RELEASE_FEATURES` value.
 *
 * Rules (fail-closed):
 * - unset/empty      -> production: PRODUCTION_FALLBACK ; otherwise every key
 * - `all`            -> every key, but REJECTED in production (too broad to be
 *                       an intentional production setting)
 * - comma list       -> unknown keys throw in production, warn+ignore elsewhere
 * - `foundation`     -> always enabled; it cannot be switched off
 */
export function resolveEnabledFeatures(options: {
  raw: string | undefined;
  env: string;
  manifest?: ReleaseManifest;
  warn?: (message: string) => void;
}): Set<string> {
  const m = options.manifest ?? RELEASE_MANIFEST;
  const production = isProduction(options.env);
  const warn = options.warn ?? ((message: string) => console.warn(`[release] ${message}`));
  const raw = options.raw?.trim() ?? '';

  const all = new Set(Object.keys(m.features));

  if (raw === '') {
    return production ? new Set<string>([...PRODUCTION_FALLBACK]) : all;
  }

  if (raw === 'all') {
    if (production) {
      throw new ReleaseConfigError(
        `${RELEASE_FEATURES_ENV}="all" is not an acceptable production setting; list features explicitly`,
      );
    }
    return all;
  }

  const requested = [...new Set(raw.split(',').map((part) => part.trim()).filter(Boolean))];
  const unknown = requested.filter((key) => !(key in m.features));

  if (unknown.length > 0) {
    if (production) {
      throw new ReleaseConfigError(
        `${RELEASE_FEATURES_ENV} references unknown feature key(s): ${unknown.join(', ')}`,
      );
    }
    warn(`ignoring unknown feature key(s): ${unknown.join(', ')}`);
  }

  const enabled = new Set(requested.filter((key) => key in m.features));
  enabled.add('foundation');
  return enabled;
}

interface ResolvedRelease {
  release: string;
  env: string;
  enabled: Set<string>;
  fingerprint: string;
}

let resolved: ResolvedRelease | null = null;

/** Re-reads the environment. Memoised on (env, raw) so tests can flip env safely. */
export function getRelease(): ResolvedRelease {
  const env = process.env.NODE_ENV || 'development';
  const raw = process.env[RELEASE_FEATURES_ENV];
  const fingerprint = `${env}|${raw ?? ''}`;

  if (resolved && resolved.fingerprint === fingerprint) return resolved;

  const enabled = resolveEnabledFeatures({ raw, env });
  resolved = { release: RELEASE_MANIFEST.release, env, enabled, fingerprint };
  return resolved;
}

/** Test hook: drops the memoised resolution. */
export function resetReleaseCache(): void {
  resolved = null;
}

export function isFeatureEnabled(key: string): boolean {
  return getRelease().enabled.has(key);
}

/**
 * Read-only snapshot for `GET /api/release`. Never writable.
 *
 * Deliberately excludes the deployment environment: it is internal operational
 * detail with no value to a client, so the public payload carries only the
 * release version, the per-key availability map and nothing else (review fix F4).
 */
export function getReleaseSnapshot(): {
  release: string;
  features: Record<string, boolean>;
} {
  const { release, enabled } = getRelease();
  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) {
    features[key] = enabled.has(key);
  }
  return { release, features };
}
