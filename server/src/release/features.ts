import manifest from './manifest.json';

/**
 * Release gating (W1.4).
 *
 * Two independent inputs, deliberately kept separate:
 *   1. `manifest.json` — the catalogue of feature keys that EXIST in source.
 *      Version-controlled, reviewed like any other code.
 *   2. `RELEASE_FEATURES` — which of those keys a DEPLOYMENT turns on.
 *
 * A key present in the manifest is NOT shipped until a deployment enables it.
 * There is no database-backed toggle and no write endpoint on purpose: an
 * Admin setting must never be able to switch on a capability that has not
 * been released (A-6, A-12).
 *
 * Feature gating is a release-visibility control, NOT a security boundary.
 * It never substitutes for requireAuth/requireAdmin, and the auth
 * infrastructure is never gated by a feature key (R-R2).
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

// Fail fast at boot: a malformed manifest must stop the process rather than
// silently gating nothing in production.
validateManifest(RELEASE_MANIFEST);

/** Deployment switch. Comma-separated keys, or the literal `all`. */
export const RELEASE_FEATURES_ENV = 'RELEASE_FEATURES';

/**
 * Fail-closed production default. `foundation` is the shell itself and
 * `auth.login` is the only capability that is both present in source and
 * safe to expose without design approval.
 */
export const PRODUCTION_FALLBACK = ['foundation', 'auth.login'] as const;

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
    if (Number(feature.since) < Number(m.release) && !Number.isFinite(Number(feature.since))) {
      throw new ReleaseConfigError(`Feature "${key}" has a non-numeric "since" version`);
    }
  }
  if (!('foundation' in m.features)) {
    throw new ReleaseConfigError('Release manifest must declare the "foundation" feature');
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

/** Read-only snapshot for `GET /api/release`. Never writable. */
export function getReleaseSnapshot(): {
  release: string;
  env: string;
  features: Record<string, boolean>;
} {
  const { release, env, enabled } = getRelease();
  const features: Record<string, boolean> = {};
  for (const key of FEATURE_KEYS) {
    features[key] = enabled.has(key);
  }
  return { release, env, features };
}
