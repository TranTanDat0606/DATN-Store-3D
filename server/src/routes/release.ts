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
 * The client uses it to hide navigation and routes for unreleased features.
 * Treat it as a visibility hint only; every protected route keeps its own
 * server-side gate.
 */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const snapshot = getReleaseSnapshot();
    return successResponse(res, { ...snapshot, catalog: FEATURE_KEYS });
  }),
);

export default router;
