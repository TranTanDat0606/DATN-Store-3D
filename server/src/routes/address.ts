import { Router } from 'express';
import { addressController } from '../controllers/addressController';
import { requireAuth } from '../middleware/auth';
import { requireFeature } from '../middleware/feature';
import { asyncHandler } from '../utils/asyncHandler';
import { z } from 'zod';
import { AppError } from '../utils/AppError';

const router = Router();

const addressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  recipientName: z.string().trim().min(1, 'Tên người nhận là bắt buộc').max(100),
  phone: z.string().trim().regex(/^[0-9+\-\s]{8,15}$/, 'Số điện thoại không hợp lệ'),
  province: z.string().trim().min(1, 'Tỉnh/Thành phố là bắt buộc'),
  district: z.string().trim().max(100).optional().default(''),
  ward: z.string().trim().min(1, 'Phường/Xã là bắt buộc'),
  street: z.string().trim().min(1, 'Địa chỉ đường là bắt buộc').max(500),
  isDefault: z.boolean().optional(),
});

// Account feature gate (W1.4 / review fix F1). Runs before requireAuth on
// purpose: a disabled capability answers 404 for everyone, and an enabled one
// falls through to the existing session check (401) exactly as before.
router.use(requireFeature('account'));

router.use(requireAuth);

router.get('/', asyncHandler(addressController.list));
router.get('/:id', asyncHandler(addressController.getById));
router.post('/', asyncHandler(async (req, res) => {
  const result = addressSchema.safeParse(req.body);
  if (!result.success) {
    throw new AppError(result.error.errors[0].message, 400);
  }
  req.body = result.data;
  return addressController.create(req, res);
}));
router.put('/:id', asyncHandler(async (req, res) => {
  const result = addressSchema.partial().safeParse(req.body);
  if (!result.success) {
    throw new AppError(result.error.errors[0].message, 400);
  }
  req.body = result.data;
  return addressController.update(req, res);
}));
router.delete('/:id', asyncHandler(addressController.remove));
router.patch('/:id/default', asyncHandler(addressController.setDefault));

export default router;
