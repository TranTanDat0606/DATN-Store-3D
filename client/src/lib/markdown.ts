import { sanitizeHtml } from './sanitize'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Script/style ELEMENTS (with their text content) are removed up front so
 * their text can never leak into the heading pre-pass below — review fix F10:
 * the TOC text and heading ids are derived from this source string, and
 * `<h2>Giới thiệu<script>alert(1)</script></h2>` would otherwise produce the
 * TOC entry "Giới thiệualert(1)" and the id `gioi-thieualert-1`.
 *
 * This is deletion-only and never admits anything: sanitizeHtml() still runs
 * LAST over the final markup (see the bottom of parseMarkdownToHtml), so the
 * sanitizer remains the single choke point.
 */
const SCRIPT_OR_STYLE_BLOCK = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi

export interface ParsedContent {
  html: string
  headings: { level: number; text: string; id: string }[]
}

export function parseMarkdownToHtml(raw: string): ParsedContent {
  const headings: { level: number; text: string; id: string }[] = []
  const usedIds = new Set<string>()

  const source = raw.replace(SCRIPT_OR_STYLE_BLOCK, '')

  const html = source.replace(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, inner) => {
    const cleanText = inner.replace(/<[^>]+>/g, '').trim()
    if (!cleanText) return _match

    let id = slugify(cleanText)
    if (usedIds.has(id)) {
      let n = 2
      while (usedIds.has(`${id}-${n}`)) n++
      id = `${id}-${n}`
    }
    usedIds.add(id)

    headings.push({ level: Number(level), text: cleanText, id })
    return `<h${level} id="${id}">${inner}</h${level}>`
  })

  // Sanitize as the LAST step: heading ids are injected above, and this is the
  // single choke point every HTML consumer (news detail today, CMS richText in
  // W1.7) must pass through. See ./sanitize.ts for the threat model.
  return { html: sanitizeHtml(html), headings }
}
