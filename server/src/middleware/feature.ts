import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { isFeatureEnabled } from '../release/features';

/**
 * Release gate for a single feature key (W1.4).
 *
 * Unreleased capabilities answer 404, never 403: a feature that has not been
 * shipped must not be advertised as existing. Per A-6 this applies to Admin
 * routes too — an administrator cannot reach a module the deployment has not
 * released, because the decision is made from the environment and the
 * version-controlled manifest, not from a database setting.
 *
 * This is NOT an authorisation control. Always keep requireAuth/requireAdmin
 * on the route as well; gating composes with them, it never replaces them.
 */
export function requireFeature(feature: string) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!isFeatureEnabled(feature)) {
      next(new AppError('Không tìm thấy trang', 404));
      return;
    }
    next();
  };
}
