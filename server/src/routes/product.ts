import { Router } from 'express';
import { productController } from '../controllers/productController';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';
import { validateRequest } from '../middleware/validate';
import { createProductSchema, updateProductSchema, productQuerySchema } from '../validators/product';

const router = Router();

// Catalog feature gate (W1.4 / review fix F1). Runs before every route —
// public and admin alike (A-6) — so a deployment that disables `catalog`
// advertises nothing: 404, never 403. When enabled, each route keeps its own
// requireAuth/requireAdmin; the gate composes with them, never replaces them.
router.use(requireFeature('catalog'));

router.get('/', validateRequest(productQuerySchema, 'query'), productController.list);
router.get('/featured', productController.featured);
router.get('/:slug', productController.getBySlug);
router.get('/:id/related', productController.related);

router.post('/', requireAuth, requireAdmin, validateRequest(createProductSchema), productController.create);
router.put('/:id', requireAuth, requireAdmin, validateRequest(updateProductSchema), productController.update);
router.delete('/:id', requireAuth, requireAdmin, productController.remove);

export default router;
