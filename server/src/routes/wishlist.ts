import { Router } from 'express';
import { wishlistController } from '../controllers/wishlistController';
import { requireAuth } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';

const router = Router();

// Account feature gate (W1.4 / review fix F1) — see address.ts for ordering.
router.use(requireFeature('account'));

router.use(requireAuth);

router.get('/', wishlistController.get);
router.post('/', wishlistController.add);
router.delete('/:productId', wishlistController.remove);
router.post('/move-to-cart', wishlistController.moveToCart);

export default router;
