import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/store3d-release-test';
process.env.JWT_SECRET ??= 'w1-release-gating-test-secret';

import { createApp } from '../src/app';
import { requireFeature } from '../src/middleware/feature';
import {
  FEATURE_KEYS,
  PRODUCTION_FALLBACK,
  RELEASE_MANIFEST,
  RELEASE_FEATURES_ENV,
  ReleaseConfigError,
  getReleaseSnapshot,
  resetReleaseCache,
  resolveEnabledFeatures,
  validateManifest,
} from '../src/release/features';

/**
 * Release manifest and feature gating (W1.4).
 *
 * Invariants under test:
 *  - production FAILS CLOSED when the switch is unset
 *  - `all` and unknown keys are unacceptable in production
 *  - unreleased routes answer 404 (never 403) so they are not advertised
 *  - AUTH INFRASTRUCTURE IS NEVER GATED (R-R2): disabling every feature must
 *    still leave /api/auth answering 401 rather than 404
 *  - the status endpoint is read-only: nothing can enable a feature remotely
 */

const ORIG_FEATURES = process.env[RELEASE_FEATURES_ENV];
const ORIG_ENV = process.env.NODE_ENV;

function withRelease(raw: string | undefined, env: string, warn?: (m: string) => void): Set<string> {
  return resolveEnabledFeatures({ raw, env, warn });
}

describe('release manifest — structural validation (W1.4)', () => {
  it('the shipped manifest is structurally valid', () => {
    assert.doesNotThrow(() => validateManifest(RELEASE_MANIFEST));
  });

  it('declares foundation and a valid semver release', () => {
    assert.ok('foundation' in RELEASE_MANIFEST.features, 'foundation must be declared');
    assert.match(RELEASE_MANIFEST.release, /^\d+\.\d+\.\d+$/);
  });

  it('every feature carries a valid semver "since"', () => {
    for (const key of FEATURE_KEYS) {
      assert.match(
        RELEASE_MANIFEST.features[key].since,
        /^\d+\.\d+\.\d+$/,
        `feature "${key}" must declare a semver "since"`,
      );
    }
  });

  it('gates the keys the approved plan depends on', () => {
    for (const key of ['foundation', 'auth.login', 'catalog', 'banners', 'cms.banner', 'cms.section', 'cms.media', 'cms.settings', 'cms.page', 'cms.nav']) {
      assert.ok(FEATURE_KEYS.includes(key), `expected feature key "${key}" in the manifest`);
    }
  });

  it('rejects a malformed manifest', () => {
    assert.throws(
      () => validateManifest({ ...RELEASE_MANIFEST, schemaVersion: 99 as never }),
      ReleaseConfigError,
    );
    assert.throws(
      () => validateManifest({ ...RELEASE_MANIFEST, release: 'nope' as never }),
      ReleaseConfigError,
    );
    assert.throws(
      () =>
        validateManifest({
          ...RELEASE_MANIFEST,
          features: { ghost: { since: '0.1.0', title: 'x', description: 'y' } },
        }),
      /must declare the "foundation" feature/,
    );
    assert.throws(
      () =>
        validateManifest({
          ...RELEASE_MANIFEST,
          features: { foundation: { since: 'x', title: 'x', description: 'y' } },
        }),
      /invalid "since"/,
    );
  });
});

describe('release resolution — fail-closed production (W1.4)', () => {
  it('unset in production falls back to foundation + auth.login only', () => {
    const enabled = withRelease(undefined, 'production');
    assert.deepEqual([...enabled].sort(), [...PRODUCTION_FALLBACK].sort());
    assert.equal(enabled.has('catalog'), false, 'catalog must NOT be on by default in production');
    assert.equal(enabled.has('cms.section'), false, 'unreleased CMS must stay off');
  });

  it('unset outside production enables everything present in source', () => {
    const enabled = withRelease(undefined, 'development');
    assert.equal(enabled.size, FEATURE_KEYS.length);
  });

  it('rejects RELEASE_FEATURES="all" in production', () => {
    assert.throws(() => withRelease('all', 'production'), ReleaseConfigError);
  });

  it('accepts RELEASE_FEATURES="all" outside production', () => {
    assert.equal(withRelease('all', 'staging').size, FEATURE_KEYS.length);
  });

  it('rejects unknown feature keys in production', () => {
    assert.throws(
      () => withRelease('foundation,catalog,not.a.feature', 'production'),
      /unknown feature key/,
    );
  });

  it('warns and ignores unknown feature keys outside production', () => {
    const warnings: string[] = [];
    const enabled = withRelease('foundation,catalog,not.a.feature', 'development', (m) =>
      warnings.push(m),
    );
    assert.equal(enabled.has('catalog'), true);
    assert.equal(enabled.has('not.a.feature'), false);
    assert.equal(warnings.length, 1, 'exactly one warning expected');
    assert.match(warnings[0], /not\.a\.feature/);
  });

  it('always keeps foundation enabled and de-duplicates the list', () => {
    const enabled = withRelease(' catalog , catalog ', 'production');
    assert.equal(enabled.has('foundation'), true, 'foundation cannot be switched off');
    assert.equal(enabled.has('catalog'), true);
  });
});

describe('GET /api/release — read-only status (W1.4)', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  beforeEach(() => {
    process.env[RELEASE_FEATURES_ENV] = 'foundation,auth.login';
    process.env.NODE_ENV = 'development';
    resetReleaseCache();
  });

  afterEach(() => {
    process.env[RELEASE_FEATURES_ENV] = ORIG_FEATURES;
    process.env.NODE_ENV = ORIG_ENV;
    resetReleaseCache();
  });

  it('answers without any authentication', async () => {
    const r = await fetch(`${baseUrl}/api/release`);
    assert.equal(r.status, 200);

    const body = (await r.json()) as {
      success: boolean;
      data: { release: string; env: string; features: Record<string, boolean>; catalog: string[] };
    };

    assert.equal(body.success, true);
    assert.equal(body.data.release, RELEASE_MANIFEST.release);
    assert.equal(body.data.features.foundation, true);
    assert.equal(body.data.features.catalog, false, 'disabled features must report false');
    assert.deepEqual(body.data.catalog, [...FEATURE_KEYS]);
  });

  it('exposes no write surface: POST/PUT/PATCH/DELETE are rejected', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      const r = await fetch(`${baseUrl}/api/release`, { method });
      assert.equal(r.status, 404, `${method} must not be a supported operation`);
    }
  });

  it('cannot be used to enable a feature: state is derived from env only', async () => {
    const before = getReleaseSnapshot().features;
    await fetch(`${baseUrl}/api/release`, { method: 'POST', body: '{"features":{"cms.section":true}}' });
    const after2 = getReleaseSnapshot().features;
    assert.deepEqual(after2, before, 'no request may change which features are enabled');
    assert.equal(after2['cms.section'], false);
  });
});

describe('requireFeature — unreleased capabilities are unreachable (W1.4)', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const gate = express();
    gate.get('/released', requireFeature('catalog'), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    gate.get('/unreleased', requireFeature('cms.section'), (_req, res) => {
      res.status(200).json({ ok: true });
    });
    server = createServer(gate);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  beforeEach(() => {
    // `catalog` must be explicitly enabled for the released probe to answer.
    process.env[RELEASE_FEATURES_ENV] = 'foundation,auth.login,catalog';
    process.env.NODE_ENV = 'development';
    resetReleaseCache();
  });

  afterEach(() => {
    process.env[RELEASE_FEATURES_ENV] = ORIG_FEATURES;
    process.env.NODE_ENV = ORIG_ENV;
    resetReleaseCache();
  });

  it('lets an enabled feature through', async () => {
    const r = await fetch(`${baseUrl}/released`);
    assert.equal(r.status, 200);
  });

  it('answers 404 — not 403 — for an unreleased feature', async () => {
    const r = await fetch(`${baseUrl}/unreleased`);
    assert.equal(r.status, 404, 'unreleased features must not be advertised as forbidden');
  });
});

describe('auth infrastructure is never gated (R-R2)', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    server = createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  beforeEach(() => {
    // Only the shell is enabled: auth.login is explicitly switched OFF.
    process.env[RELEASE_FEATURES_ENV] = 'foundation';
    process.env.NODE_ENV = 'development';
    resetReleaseCache();
  });

  afterEach(() => {
    process.env[RELEASE_FEATURES_ENV] = ORIG_FEATURES;
    process.env.NODE_ENV = ORIG_ENV;
    resetReleaseCache();
  });

  it('still answers 401 (not 404) on /api/auth/me with every feature off', async () => {
    const r = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(
      r.status,
      401,
      'auth endpoints must remain operational — gating controls visibility, not security',
    );
  });

  it('still answers 401 on an admin route with every feature off', async () => {
    const r = await fetch(`${baseUrl}/api/admin/stats/overview`);
    assert.equal(r.status, 401, 'authorisation must still apply, not a release 404');
  });

  it('still serves the health check', async () => {
    const r = await fetch(`${baseUrl}/api/health`);
    assert.equal(r.status, 200);
  });
});
