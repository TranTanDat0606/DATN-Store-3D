import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { config } from '../config';
import { paymentService } from '../services/paymentService';
import { successResponse } from '../utils/apiResponse';

const router = Router();

/**
 * Shared-secret comparison for the `x-payment-signature` header (format unchanged:
 * the header must equal the configured PAYMENT_WEBHOOK_SECRET).
 *
 * - Constant-time (timingSafeEqual) to avoid timing side channels.
 * - Malformed/multi-value headers (non-string) never match.
 * - The secret and the supplied signature are never echoed in errors or logs.
 */
function signatureMatches(provided: unknown, secret: string): boolean {
  if (typeof provided !== 'string') return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(secret, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

router.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const secret = config.paymentWebhookSecret;
    if (!secret) {
      // Fail closed: without a configured secret the request cannot be
      // authenticated, so payment status must not change.
      throw new AppError('Webhook thanh toán chưa được cấu hình', 503);
    }
    if (!signatureMatches(req.headers['x-payment-signature'], secret)) {
      throw new AppError('Chữ ký webhook không hợp lệ', 401);
    }
    const { orderCode, amount } = req.body ?? {};
    await paymentService.markOrderPaid(String(orderCode ?? ''), Number(amount));
    return successResponse(res, { status: 'success' }, { message: 'Thanh toán được xác nhận' });
  }),
);

// DEV-only twin of the webhook: runs the exact same server-side reconciler.
// Allowlist (not blocklist): only development/test may reach it — unknown or
// production-like environments get 404, so a mis-set NODE_ENV cannot bypass
// production security.
router.post(
  '/webhook/simulate',
  asyncHandler(async (req, res) => {
    if (config.env !== 'development' && config.env !== 'test') {
      throw new AppError('Không tìm thấy trang', 404);
    }
    const { orderCode, amount } = req.body ?? {};
    await paymentService.markOrderPaid(String(orderCode ?? ''), Number(amount));
    return successResponse(res, { status: 'success' }, { message: 'Thanh toán được xác nhận' });
  }),
);

export default router;
