import { Router } from 'express';
import { categoryController } from '../controllers/categoryController';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';
import { validateRequest } from '../middleware/validate';
import { createCategorySchema, updateCategorySchema } from '../validators/category';

const router = Router();

// Catalog feature gate (W1.4 / review fix F1): categories ship with catalog.
router.use(requireFeature('catalog'));

router.get('/', categoryController.list);
router.get('/all', categoryController.all);
router.get('/:slug', categoryController.getBySlug);

router.post('/', requireAuth, requireAdmin, validateRequest(createCategorySchema), categoryController.create);
router.put('/:id', requireAuth, requireAdmin, validateRequest(updateCategorySchema), categoryController.update);
router.delete('/:id', requireAuth, requireAdmin, categoryController.remove);

export default router;
