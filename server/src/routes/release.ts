import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse } from '../utils/apiResponse';
import { FEATURE_KEYS, getReleaseSnapshot } from '../release/features';

const router = Router();

/**
 * Read-only release status (W1.4).
 *
 * Deliberately GET-only and derived purely from the environment plus the
 * version-controlled manifest: there is no body to accept and nothing to
 * persist, so no caller — including an administrator — can enable a feature
 * that this deployment has not released.
 *
 * What it is (review fix F2): an authoritative report of what this deployment
 * has switched on. Every key with wired routes is enforced by
 * requireFeature() on its router (product/category → catalog, news → news,
 * addresses/wishlist → account, register → auth.register), so `false` here
 * means those routes answer 404. Keys without a gated route yet (banners,
 * cms.*) report false in production until a deployment enables them, and the
 * W2+ routes that carry them must mount requireFeature(key) when they land.
 * `cms.media` is the future media library: the existing /api/upload endpoint
 * is shared admin infrastructure and is intentionally ungated by feature keys.
 * GET /api/release itself and auth infrastructure stay ungated (R-R2).
 *
 * Client-side consumption is intentionally NOT wired yet: no Storefront/Admin
 * UI may be built before Gate 1 design approval (A-13).
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const snapshot = getReleaseSnapshot();
    return successResponse(res, { ...snapshot, catalog: FEATURE_KEYS });
  }),
);

export default router;
