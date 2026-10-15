import { Router } from 'express';
import { authController } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';
import { validateRequest } from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  updatePasswordSchema,
} from '../validators/auth';
import { authLimiter } from '../config/rateLimit';

const router = Router();

// Registration is the ONE auth route gated by a feature key (auth.register):
// creating accounts is a releasable capability. Everything else below —
// login, logout, session, profile, password — is auth infrastructure and is
// never gated (R-R2): those routes answer 401/400 regardless of the switch.
// The gate runs first so a disabled registration is 404 without consuming
// rate-limit budget (review fix F1).
router.post('/register', requireFeature('auth.register'), authLimiter, validateRequest(registerSchema), authController.register);
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login);
router.post('/logout', authController.logout);

router.get('/me', requireAuth, authController.me);
router.put('/profile', requireAuth, validateRequest(updateProfileSchema), authController.updateProfile);
router.put('/password', requireAuth, validateRequest(updatePasswordSchema), authController.updatePassword);

export default router;
