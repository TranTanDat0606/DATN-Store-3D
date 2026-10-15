import DOMPurify from 'dompurify'

/**
 * Single sanitizer for every untrusted HTML string rendered by the client.
 *
 * W1.1 (stored XSS). `server/src/validators/news.ts` accepts `content` as
 * `z.string().trim().min(1)` with NO HTML restriction, and
 * `pages/news-detail-page.tsx` renders it through `dangerouslySetInnerHTML`
 * on a public route. Admin-authored content is therefore untrusted input that
 * anonymous visitors read — a stored-XSS channel. Any future CMS richText
 * (W1.7) MUST render through this module too; do not add a second sanitizer.
 */

/**
 * Explicit allowlist: only the semantics the article "prose" stylesheet
 * actually styles. Anything outside it is dropped, which keeps the surface
 * narrow instead of inheriting a broad default and removing the bad parts.
 */
const ALLOWED_TAGS = [
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'small',
  'sub',
  'sup',
  'blockquote',
  'cite',
  'q',
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'a',
  'img',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
  'span',
  'div',
  'abbr',
  'time',
]

/**
 * Attributes required by the article markup. `id` is retained because
 * `parseMarkdownToHtml` injects heading ids for the table of contents.
 * `class` is retained because Tailwind prose modifiers style the content.
 */
const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'id', 'class', 'colspan', 'rowspan', 'lang']

/**
 * Belt-and-braces: these are already outside ALLOWED_TAGS / ALLOWED_ATTR, but
 * naming them documents intent and protects against a future allowlist edit
 * accidentally admitting a document-replacement vector (`srcdoc`) or an
 * inline-CSS layout attack (`style`).
 */
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'base', 'meta', 'link']
const FORBID_ATTR = ['srcdoc', 'style', 'formaction', 'action', 'ping', 'background']

/** Only absolute http(s)/mailto/tel links and relative site paths navigate. */
const ALLOWED_URI_PATTERN = /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-:]|$))/i

let hooksRegistered = false

function registerHooks(): void {
  if (hooksRegistered) return
  hooksRegistered = true

  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return

    // `target=_blank` without `rel` hands the opener over to the new page.
    if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

/**
 * Returns HTML that is safe to insert into the DOM.
 *
 * Guarantees:
 * - no `<script>` / `<style>` / `<iframe>` / `<object>` / `<embed>` / form controls
 * - no inline event handlers (`on*`) and no `srcdoc` / `style` attributes
 * - no `javascript:`, `vbscript:` or `data:` URL schemes
 * - legitimate Vietnamese article formatting and heading ids survive
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  registerHooks()

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_ATTR,
    ALLOWED_URI_REGEXP: ALLOWED_URI_PATTERN,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    USE_PROFILES: false,
    RETURN_TRUSTED_TYPE: false,
  }) as string
}
