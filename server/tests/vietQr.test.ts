import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
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

// A valid 1x1 PNG so the served payload is a genuine image byte-stream.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// Hermetic replacement for the former live-CDN check. It exercises the same
// contract the caller depends on — "the generated link resolves to a 2xx image
// response" — against a local server instead of img.vietqr.io, so required CI
// never depends on an external network hop. Only the ORIGIN is swapped; the
// path and query are byte-for-byte the strings buildVietQrQuickLink produced,
// which lets this also assert they survive a real HTTP round-trip uncorrupted.
test('generated VietQR link resolves to an image response (hermetic)', async () => {
  let received = '';
  const server = http.createServer((req, res) => {
    received = req.url ?? '';
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': String(PNG_1X1.byteLength) });
    res.end(PNG_1X1);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  try {
    const link = buildVietQrQuickLink({ ...bank, amount: 250000, content: 'ST3D-TEST001' });
    const expected = new URL(link);
    const local = new URL(link);
    local.protocol = 'http:';
    local.hostname = '127.0.0.1';
    local.port = String(port);

    const res = await fetch(local.toString());
    assert.equal(res.ok, true);
    assert.match(res.headers.get('content-type') ?? '', /^image\//);
    assert.equal(received, expected.pathname + expected.search);

    const body = Buffer.from(await res.arrayBuffer());
    assert.equal(body.byteLength, PNG_1X1.byteLength);
    assert.ok(body.equals(PNG_1X1));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('getBankName resolves known and unknown BINs', () => {
  assert.equal(getBankName('970423'), 'TPBank – Tiên Phong Bank');
  assert.equal(getBankName('970418'), 'Vietcombank');
  assert.equal(getBankName('999999'), 'Ngân hàng (999999)');
});