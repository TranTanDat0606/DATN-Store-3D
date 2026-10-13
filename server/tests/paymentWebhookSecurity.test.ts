import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { config } from '../src/config';
import { Order } from '../src/models';
import { emailService } from '../src/services/email/email.service';

/**
 * Payment webhook security tests (Gate A2.1).
 *
 * Seam: the HTTP pipeline (route -> signature gate -> paymentService.markOrderPaid ->
 * validateReconcile) is REAL. Only the persistence boundary is replaced (no test DB
 * available in CI) and the outbound email sender is neutralized (no network in tests).
 */

const SECRET = 'test-webhook-secret-1234';
const CODE = 'ST3D-SEC01';
const TOTAL = 150000;

interface FakeOrder {
  _id: string;
  total: number;
  subtotal: number;
  discount: number;
  shipping: number;
  status: string;
  paidAt?: Date;
  payment: { status: string; orderCode: string; qrExpiresAt: Date; method: string };
  customer: { name: string; email: string; address: string };
  items: Array<{ product: { name: string }; quantity: number; price: number }>;
  createdAt: Date;
}

const db = new Map<string, FakeOrder>();
const stats = { findOneCalls: 0, updateCalls: 0, transitions: 0, emails: 0 };

const cfg = config as unknown as { env: string; paymentWebhookSecret: string };
const ORIG_ENV = cfg.env;
const ORIG_SECRET = cfg.paymentWebhookSecret;

const origFindOne = Order.findOne;
const origFindOneAndUpdate = Order.findOneAndUpdate;
const origSendPaymentSuccess = emailService.sendPaymentSuccess;

function seedOrder(
  overrides: {
    paymentStatus?: string;
    orderStatus?: string;
    expiresAt?: Date;
    orderCode?: string;
    total?: number;
  } = {},
): FakeOrder {
  const orderCode = overrides.orderCode ?? CODE;
  const total = overrides.total ?? TOTAL;
  const order: FakeOrder = {
    _id: '64b000000000000000000001',
    total,
    subtotal: total,
    discount: 0,
    shipping: 0,
    status: overrides.orderStatus ?? 'pending',
    payment: {
      status: overrides.paymentStatus ?? 'pending_payment',
      orderCode,
      qrExpiresAt: overrides.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000),
      method: 'bank-transfer',
    },
    customer: { name: 'Nguyen Van A', email: 'a@example.com', address: 'Ha Noi' },
    items: [{ product: { name: 'Mo hinh A' }, quantity: 1, price: total }],
    createdAt: new Date(),
  };
  db.set(orderCode, order);
  return order;
}

let server: Server;
let baseUrl = '';

async function post(path: string, body: unknown, signature?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (signature !== undefined) headers['x-payment-signature'] = signature;
  const res = await fetch(baseUrl + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

describe('payment webhook security', () => {
  before(async () => {
    // Persistence seam: no test DB in CI, so replace the two statics markOrderPaid uses.
    Order.findOne = ((query: unknown) => {
      stats.findOneCalls++;
      const code = (query as Record<string, unknown> | null | undefined)?.['payment.orderCode'];
      const found = typeof code === 'string' ? db.get(code) : undefined;
      return Promise.resolve(found ?? null);
    }) as typeof Order.findOne;

    Order.findOneAndUpdate = ((filter: unknown, update: unknown) => {
      stats.updateCalls++;
      const f = filter as Record<string, unknown>;
      const id = String(f._id);
      const target = [...db.values()].find((o) => String(o._id) === id);
      const neCond = f['payment.status'] as { $ne?: string } | undefined;
      let doc: FakeOrder | null = null;
      if (target && (!neCond || target.payment.status !== neCond.$ne)) {
        const set = (update as { $set?: Record<string, unknown> }).$set ?? {};
        for (const [key, value] of Object.entries(set)) {
          if (key.startsWith('payment.')) {
            (target.payment as unknown as Record<string, unknown>)[key.slice('payment.'.length)] = value;
          } else {
            (target as unknown as Record<string, unknown>)[key] = value;
          }
        }
        stats.transitions++;
        doc = target;
      }
      return { populate: () => Promise.resolve(doc) };
    }) as typeof Order.findOneAndUpdate;

    // Outbound email must never hit the network from tests.
    emailService.sendPaymentSuccess = (() => {
      stats.emails++;
      return Promise.resolve();
    }) as typeof emailService.sendPaymentSuccess;

    const app = createApp();
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    Order.findOne = origFindOne;
    Order.findOneAndUpdate = origFindOneAndUpdate;
    emailService.sendPaymentSuccess = origSendPaymentSuccess;
    cfg.env = ORIG_ENV;
    cfg.paymentWebhookSecret = ORIG_SECRET;
    await new Promise<void>((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
      server.closeAllConnections();
    });
  });

  beforeEach(() => {
    db.clear();
    stats.findOneCalls = 0;
    stats.updateCalls = 0;
    stats.transitions = 0;
    stats.emails = 0;
    cfg.env = ORIG_ENV;
    cfg.paymentWebhookSecret = ORIG_SECRET;
  });

  it('rejects every webhook when PAYMENT_WEBHOOK_SECRET is not configured (fail closed)', async () => {
    seedOrder();
    cfg.paymentWebhookSecret = '';

    const withoutSig = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL });
    const withSig = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL }, SECRET);

    assert.equal(withoutSig.status, 503, 'unconfigured webhook must be rejected, not processed');
    assert.equal(withSig.status, 503, 'unconfigured webhook must be rejected even with a signature');
    assert.equal(stats.findOneCalls, 0, 'no order lookup may happen when auth is unavailable');
    assert.equal(db.get(CODE)!.payment.status, 'pending_payment', 'order must stay unpaid');
    assert.equal(stats.transitions, 0);
  });

  it('rejects a webhook request with a missing signature', async () => {
    seedOrder();
    cfg.paymentWebhookSecret = SECRET;

    const r = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL });

    assert.equal(r.status, 401);
    assert.equal(stats.findOneCalls, 0, 'must reject before touching any order data');
    assert.equal(db.get(CODE)!.payment.status, 'pending_payment');
  });

  it('rejects a webhook request with an invalid signature and leaks no secrets', async () => {
    seedOrder();
    cfg.paymentWebhookSecret = SECRET;

    const r = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL }, 'wrong-signature-value');

    assert.equal(r.status, 401);
    assert.equal(stats.findOneCalls, 0);
    assert.ok(!r.text.includes(SECRET), 'response must not echo the configured secret');
    assert.ok(!r.text.includes('wrong-signature-value'), 'response must not echo the supplied signature');
  });

  it('accepts a valid signature and reconciles the payment', async () => {
    seedOrder();
    cfg.paymentWebhookSecret = SECRET;

    const r = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL }, SECRET);

    assert.equal(r.status, 200);
    const order = db.get(CODE)!;
    assert.equal(order.payment.status, 'paid');
    assert.equal(order.status, 'confirmed');
    assert.ok(order.paidAt instanceof Date, 'paidAt must be set');
    assert.equal(stats.transitions, 1);
    assert.equal(stats.emails, 1);
  });

  it('rejects a modified payload through server-side reconciliation', async () => {
    seedOrder();
    cfg.paymentWebhookSecret = SECRET;

    const tamperedAmount = await post(
      '/api/payment/webhook',
      { orderCode: CODE, amount: TOTAL - 1 },
      SECRET,
    );
    const unknownCode = await post(
      '/api/payment/webhook',
      { orderCode: 'ST3D-NOPE9', amount: TOTAL },
      SECRET,
    );

    assert.equal(tamperedAmount.status, 400, 'tampered amount must be rejected');
    assert.equal(unknownCode.status, 404, 'unknown order code must be rejected');
    assert.equal(stats.transitions, 0, 'no state change for tampered payloads');
    assert.equal(db.get(CODE)!.payment.status, 'pending_payment');
  });

  it('handles duplicate webhook delivery idempotently', async () => {
    seedOrder();
    cfg.paymentWebhookSecret = SECRET;

    const first = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL }, SECRET);
    const paidAtAfterFirst = db.get(CODE)!.paidAt;
    const second = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL }, SECRET);

    assert.equal(first.status, 200);
    assert.equal(second.status, 200, 'duplicate delivery must not error');
    assert.equal(stats.transitions, 1, 'state must transition exactly once');
    assert.equal(stats.emails, 1, 'confirmation email must be sent exactly once');
    assert.equal(+db.get(CODE)!.paidAt!, +paidAtAfterFirst!, 'paidAt must not be rewritten');
    assert.equal(db.get(CODE)!.payment.status, 'paid');
  });

  it('rejects an invalid payment status transition (cancelled order)', async () => {
    seedOrder({ paymentStatus: 'unpaid', orderStatus: 'cancelled' });
    cfg.paymentWebhookSecret = SECRET;

    const r = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL }, SECRET);

    assert.equal(r.status, 409);
    assert.equal(stats.transitions, 0);
    assert.equal(db.get(CODE)!.payment.status, 'unpaid');
    assert.equal(db.get(CODE)!.status, 'cancelled');
  });

  it('rejects reconciliation for an expired QR code', async () => {
    seedOrder({ expiresAt: new Date(Date.now() - 1000) });
    cfg.paymentWebhookSecret = SECRET;

    const r = await post('/api/payment/webhook', { orderCode: CODE, amount: TOTAL }, SECRET);

    assert.equal(r.status, 400);
    assert.equal(stats.transitions, 0);
    assert.equal(db.get(CODE)!.payment.status, 'pending_payment');
  });

  it('returns 404 for the simulation route when NODE_ENV is production', async () => {
    seedOrder();
    cfg.env = 'production';

    const r = await post('/api/payment/webhook/simulate', { orderCode: CODE, amount: TOTAL });

    assert.equal(r.status, 404);
    assert.equal(stats.findOneCalls, 0, 'production must never reach reconciliation via simulate');
    assert.equal(db.get(CODE)!.payment.status, 'pending_payment');
  });

  it('returns 404 for the simulation route in any non-development environment', async () => {
    seedOrder();
    cfg.env = 'staging';

    const r = await post('/api/payment/webhook/simulate', { orderCode: CODE, amount: TOTAL });

    assert.equal(r.status, 404, 'unknown environments must not expose the dev simulation route');
    assert.equal(stats.findOneCalls, 0);
    assert.equal(db.get(CODE)!.payment.status, 'pending_payment');
  });

  it('keeps the simulation route working in development', async () => {
    seedOrder();
    cfg.env = 'development';

    const r = await post('/api/payment/webhook/simulate', { orderCode: CODE, amount: TOTAL });

    assert.equal(r.status, 200, 'legitimate dev simulation flow must be preserved');
    assert.equal(db.get(CODE)!.payment.status, 'paid');
    assert.equal(stats.transitions, 1);
  });
});
