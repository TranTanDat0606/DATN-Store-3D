import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVietQrQuickLink, getBankName } from '../src/services/vietQrService';

const bank = { bin: '970423', accountNumber: 'YOUR_BANK_ACCOUNT_NUMBER', accountName: 'YOUR_ACCOUNT_NAME' };

test('buildVietQrQuickLink returns the official VietQR Quick Link', () => {
  const url = buildVietQrQuickLink({ ...bank, amount: 250000, content: 'ST3D-ABCDEF' });
  assert.ok(url.startsWith('https://img.vietqr.io/image/970423-YOUR_BANK_ACCOUNT_NUMBER-qr_only.png?'));
  assert.ok(url.includes('amount=250000'));
  assert.ok(url.includes('addInfo=ST3D-ABCDEF'));
  assert.ok(url.includes('accountName=YOUR_ACCOUNT_NAME'));
});

test('buildVietQrQuickLink URL-encodes the account name', () => {
  const url = buildVietQrQuickLink({ ...bank, accountName: 'YOUR ACCOUNT DISPLAY NAME', amount: 100000, content: 'ST3D-TEST001' });
  assert.ok(url.includes('accountName=YOUR+ACCOUNT+DISPLAY+NAME'));
});

test('official VietQR CDN serves a QR image for the generated link', async () => {
  const link = buildVietQrQuickLink({ ...bank, amount: 250000, content: 'ST3D-TEST001' });
  const res = await fetch(link);
  assert.equal(res.ok, true);
  assert.match(res.headers.get('content-type') ?? '', /^image\//);
});

test('getBankName resolves known and unknown BINs', () => {
  assert.equal(getBankName('970423'), 'TPBank – Tiên Phong Bank');
  assert.equal(getBankName('970418'), 'Vietcombank');
  assert.equal(getBankName('999999'), 'Ngân hàng (999999)');
});