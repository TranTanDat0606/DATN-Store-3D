import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { requireAdmin, requireAuth, type AuthRequest } from '../src/middleware/auth';
import { User, UserRole } from '../src/models';
import { signToken } from '../src/utils/token';

// CI and fresh worktrees ship no .env (only .env.example). Config validation is
// lazy — it fires on first access, not on import — so supplying dummy values
// here keeps the suite hermetic without a real database or secret.
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/store3d-auth-test';
process.env.JWT_SECRET ??= 'w1-auth-active-state-test-secret';

/**
 * Authentication hardening (W1.3).
 *
 * A JWT stays valid for 7 days (see utils/token.ts). requireAuth previously
 * loaded only `_id role`, so a user deactivated from the admin panel kept full
 * access until their token expired. requireAdmin only compared `role`, so a
 * DEACTIVATED ADMIN kept administrative access the same way.
 */

interface FakeUser {
  _id: Types.ObjectId;
  role: UserRole;
  active: boolean;
}

let selectedFields = '';
let origFindById: typeof User.findById;

function makeUser(overrides: Partial<FakeUser> = {}): FakeUser {
  return {
    _id: new Types.ObjectId(),
    role: overrides.role ?? UserRole.Customer,
    active: overrides.active ?? true,
  };
}

/** Stands in for the query chain `User.findById(id).select(fields)`. */
function stubUser(user: FakeUser | null): void {
  User.findById = ((_id: unknown) => ({
    select: (fields: string) => {
      selectedFields = fields;
      return Promise.resolve(user);
    },
  })) as unknown as typeof User.findById;
}

function makeReq(token?: string): AuthRequest {
  const req = {
    cookies: token ? { token } : {},
    headers: {},
  } as unknown as AuthRequest;
  return req;
}

function runRequireAuth(req: AuthRequest): Promise<unknown> {
  return new Promise((resolve) => {
    void requireAuth(req, {} as never, (err?: unknown) => resolve(err));
  });
}

function runRequireAdmin(req: AuthRequest): Promise<unknown> {
  return new Promise((resolve) => {
    requireAdmin(req, {} as never, (err?: unknown) => resolve(err));
  });
}

describe('requireAuth — deactivated account enforcement (W1.3)', () => {
  beforeEach(() => {
    selectedFields = '';
    origFindById = User.findById;
  });

  afterEach(() => {
    User.findById = origFindById;
  });

  it('selects the `active` field so the check cannot be silently skipped', async () => {
    const user = makeUser();
    stubUser(user);

    await runRequireAuth(makeReq(signToken(user._id, user.role)));

    assert.ok(
      selectedFields.split(/\s+/).includes('active'),
      `select("${selectedFields}") must include the active field`,
    );
  });

  it('rejects a deactivated customer holding an otherwise valid JWT', async () => {
    const user = makeUser({ active: false });
    stubUser(user);

    const err = await runRequireAuth(makeReq(signToken(user._id, user.role)));

    assert.ok(err instanceof Error, 'deactivated user must be rejected');
    assert.match((err as Error).message, /khóa|vô hiệu|không hợp lệ/i);
  });

  it('still accepts an active customer', async () => {
    const user = makeUser({ active: true });
    stubUser(user);
    const req = makeReq(signToken(user._id, user.role));

    const err = await runRequireAuth(req);

    assert.equal(err, undefined, 'active user must pass');
    assert.equal(req.user?._id, String(user._id));
    assert.equal(req.user?.role, UserRole.Customer);
  });

  it('keeps rejecting a missing token, an unknown user and an unknown role', async () => {
    stubUser(makeUser());
    const noToken = await runRequireAuth(makeReq(undefined));
    assert.ok(noToken instanceof Error, 'missing token must be rejected');

    stubUser(null);
    const deleted = await runRequireAuth(makeReq(signToken(new Types.ObjectId(), 'customer')));
    assert.ok(deleted instanceof Error, 'unknown user must be rejected');
  });
});

describe('requireAdmin — deactivated admin enforcement (W1.3)', () => {
  beforeEach(() => {
    selectedFields = '';
    origFindById = User.findById;
  });

  afterEach(() => {
    User.findById = origFindById;
  });

  it('rejects a deactivated ADMIN, not merely a non-admin', async () => {
    const admin = makeUser({ role: UserRole.Admin, active: false });
    stubUser(admin);
    const req = makeReq(signToken(admin._id, admin.role));

    const authErr = await runRequireAuth(req);

    assert.ok(authErr instanceof Error, 'deactivated admin must fail requireAuth itself');
    assert.ok(
      req.user === undefined,
      'a deactivated admin must never be attached to req.user',
    );
  });

  it('still authorises an active admin', async () => {
    const admin = makeUser({ role: UserRole.Admin, active: true });
    stubUser(admin);
    const req = makeReq(signToken(admin._id, admin.role));

    const authErr = await runRequireAuth(req);
    const adminErr = runRequireAdmin(req);

    assert.equal(authErr, undefined);
    assert.equal(await adminErr, undefined, 'active admin must be authorised');
  });

  it('still refuses an active non-admin', async () => {
    const user = makeUser({ role: UserRole.Customer, active: true });
    stubUser(user);
    const req = makeReq(signToken(user._id, user.role));

    await runRequireAuth(req);
    const adminErr = await runRequireAdmin(req);

    assert.ok(adminErr instanceof Error, 'customer must not pass requireAdmin');
    assert.match((adminErr as Error).message, /quyền/i);
  });
});
