import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isStrongSeedPassword,
  resolveSeedCredential,
  SEED_PASSWORD_MIN_LENGTH,
} from '../src/utils/seedCredentials';

test('resolveSeedCredential skips when the env var is missing or empty', () => {
  for (const value of [undefined, '', '   ']) {
    const plan = resolveSeedCredential(value);
    assert.equal(plan.create, false);
    assert.equal(plan.reason, 'env-missing');
    assert.equal(plan.password, undefined);
  }
});

test('resolveSeedCredential rejects weak passwords', () => {
  const weakPasswords = [
    'short1',
    '123456789012',
    'onlyletterspassword',
    'CHANGE_ME_DEMO_PASSWORD',
  ];
  for (const value of weakPasswords) {
    const plan = resolveSeedCredential(value);
    assert.equal(plan.create, false);
    assert.equal(plan.reason, 'password-weak');
    assert.equal(plan.password, undefined);
  }
});

test('resolveSeedCredential accepts a strong password unchanged', () => {
  const strong = 'Seed-Str0ng-Pass-2026';
  const plan = resolveSeedCredential(strong);
  assert.equal(plan.create, true);
  assert.equal(plan.reason, undefined);
  assert.equal(plan.password, strong);
});

test('isStrongSeedPassword enforces length and character mix', () => {
  assert.equal(isStrongSeedPassword('a1' + 'x'.repeat(SEED_PASSWORD_MIN_LENGTH)), true);
  assert.equal(isStrongSeedPassword('a'.repeat(SEED_PASSWORD_MIN_LENGTH)), false);
  assert.equal(isStrongSeedPassword('1'.repeat(SEED_PASSWORD_MIN_LENGTH)), false);
  assert.equal(isStrongSeedPassword('A1'), false);
});
