import { Router } from 'express';
import { newsController } from '../controllers/newsController';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';
import { validateRequest } from '../middleware/validate';
import { createNewsSchema, updateNewsSchema, newsQuerySchema } from '../validators/news';

const router = Router();

// News feature gate (W1.4 / review fix F1). Mounts before the public AND the
// admin section: a feature the deployment has not released must 404 for an
// administrator exactly as it does for an anonymous visitor (A-6).
router.use(requireFeature('news'));

// Public routes
router.get('/categories', newsController.categories);
router.get('/', validateRequest(newsQuerySchema, 'query'), newsController.list);
router.get('/:slug', newsController.getBySlug);

// Admin routes
router.get('/admin/all', requireAuth, requireAdmin, validateRequest(newsQuerySchema, 'query'), newsController.adminList);
router.get('/admin/:id', requireAuth, requireAdmin, newsController.adminGetById);
router.post('/admin', requireAuth, requireAdmin, validateRequest(createNewsSchema), newsController.create);
router.put('/admin/:id', requireAuth, requireAdmin, validateRequest(updateNewsSchema), newsController.update);
router.delete('/admin/:id', requireAuth, requireAdmin, newsController.remove);

export default router;
