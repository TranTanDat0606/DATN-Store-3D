import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgDataUri } from '../src/utils/imagePlaceholder';

const PREFIX = 'data:image/svg+xml;base64,';

/**
 * Every `&` must begin a valid entity. Shared by the well-formedness gate and
 * the production regression assertion so the two can never drift apart.
 */
const BARE_AMP = /&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/;

function decode(uri: string): string {
  assert.ok(
    uri.startsWith(PREFIX),
    `expected a base64 SVG data URI, got: ${uri.slice(0, 60)}`
  );
  return Buffer.from(uri.slice(PREFIX.length), 'base64').toString('utf8');
}

/**
 * Minimal well-formedness gate for the generated SVG.
 *
 * The production failure this suite guards against is a raw `&` making the
 * document unparseable, so the browser rejects the whole image. We therefore
 * assert (a) every `&` starts a valid entity and (b) every opened tag closes.
 * No third-party XML parser is added for this — the project carries none.
 */
function assertWellFormedSvg(svg: string): void {
  assert.ok(!BARE_AMP.test(svg), 'SVG contains a raw "&" that is not a valid entity');

  const stack: string[] = [];
  const tag = /<(\/?)([A-Za-z][A-Za-z0-9:.-]*)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tag.exec(svg)) !== null) {
    if (m[1] === '/') {
      const open = stack.pop();
      assert.equal(open, m[2], `mismatched closing tag </${m[2]}>`);
    } else if (m[4] !== '/') {
      stack.push(m[2]);
    }
  }
  assert.deepEqual(stack, [], `unclosed tags: ${stack.join(', ')}`);
}

/** Decode the five XML entities, for round-trip assertions on visible text. */
function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** The visible string of the first <text> node (the label). */
function firstTextContent(svg: string): string {
  const m = /<text[^>]*>([\s\S]*?)<\/text>/.exec(svg);
  assert.ok(m, 'generated SVG has no <text> element');
  return m[1];
}

/* ------------------------------------------------------------------ */

test('svgDataUri emits a base64 SVG data URI with a parseable root', () => {
  const uri = svgDataUri('Moc khoa mini');
  const svg = decode(uri);
  assert.ok(svg.startsWith('<svg '), 'decoded payload should start with <svg');
  assert.ok(svg.endsWith('</svg>'), 'decoded payload should end with </svg>');
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assertWellFormedSvg(svg);
});

// The exact production defect: "Phụ kiện & Cosplay" contains a bare "&".
test('escapes the ampersand in "Phụ kiện & Cosplay" (production regression)', () => {
  const uri = svgDataUri('Phụ kiện & Cosplay');
  const svg = decode(uri);

  assert.ok(
    !BARE_AMP.test(svg),
    'no bare "&" may survive in the generated SVG'
  );
  assert.ok(svg.includes('Phụ kiện &amp; Cosplay'), 'ampersand must be entity-encoded');

  // Round-trip: the text the browser actually draws is unchanged.
  assert.equal(unescapeXml(firstTextContent(svg)), 'Phụ kiện & Cosplay');
  assertWellFormedSvg(svg);
});

test('escapes angle brackets so they cannot break out of the text node', () => {
  const svg = decode(svgDataUri('A < B > C'));
  assert.ok(svg.includes('A &lt; B &gt; C'));
  assert.ok(!/< B/.test(svg), 'raw "<" must not survive');
  assert.equal(unescapeXml(firstTextContent(svg)), 'A < B > C');
  assertWellFormedSvg(svg);
});

test('escapes quotes in the label', () => {
  const svg = decode(svgDataUri(`He said "hi" and it's fine`));
  assert.ok(svg.includes('&quot;'));
  assert.ok(svg.includes('&apos;'));
  assert.equal(unescapeXml(firstTextContent(svg)), `He said "hi" and it's fine`);
  assertWellFormedSvg(svg);
});

test('handles every special character together', () => {
  const label = `K & L <mod> "x" 'y' 100%`;
  const svg = decode(svgDataUri(label));
  assert.equal(unescapeXml(firstTextContent(svg)), label);
  assertWellFormedSvg(svg);
});

test('is idempotent-safe: already-escaped input is not corrupted', () => {
  // A literal "&amp;" in source data must render as the text "&amp;", not "&".
  const svg = decode(svgDataUri('AT&amp;T'));
  assert.ok(svg.includes('&amp;amp;'), 'the "&" of a literal "&amp;" must be re-escaped');
  assert.equal(unescapeXml(firstTextContent(svg)), 'AT&amp;T');
  assertWellFormedSvg(svg);
});

test('keeps non-ASCII (Vietnamese) labels intact', () => {
  const svg = decode(svgDataUri('Mô hình máy móc'));
  assert.ok(svg.includes('Mô hình máy móc'), 'UTF-8 text must be preserved verbatim');
  assert.equal(unescapeXml(firstTextContent(svg)), 'Mô hình máy móc');
  assertWellFormedSvg(svg);
});

test('honours the size argument on the root element', () => {
  const svg = decode(svgDataUri('Demo', 0, 400));
  assert.ok(svg.includes('width="400"'), 'root width must follow size');
  assert.ok(svg.includes('height="400"'), 'root height must follow size');
  assert.ok(svg.includes('viewBox="0 0 400 400"'), 'viewBox must follow size');
  assertWellFormedSvg(svg);
});

test('is deterministic for identical input', () => {
  assert.equal(svgDataUri('Phụ kiện & Cosplay', 2, 400), svgDataUri('Phụ kiện & Cosplay', 2, 400));
});

test('empty label still yields valid SVG', () => {
  const svg = decode(svgDataUri(''));
  assertWellFormedSvg(svg);
  assert.ok(svg.includes('<svg '));
});
