import { describe, expect, it } from 'vitest'
import { parseMarkdownToHtml } from '@/lib/markdown'

/**
 * Stored-XSS regression suite (W1.1).
 *
 * `news-detail-page.tsx` renders `parseMarkdownToHtml(news.content).html`
 * through `dangerouslySetInnerHTML` on a PUBLIC route, while
 * `server/src/validators/news.ts` constrains `content` only as
 * `z.string().trim().min(1)` (no HTML restriction). Content is therefore
 * attacker-controlled once an admin account is compromised, and is read by
 * anonymous visitors — privilege stored XSS.
 *
 * These tests assert the parser output is SAFE TO INSERT into the DOM.
 */
describe('parseMarkdownToHtml — stored XSS hardening', () => {
  it('removes <script> elements together with their content', () => {
    const { html } = parseMarkdownToHtml('<p>Hi</p><script>alert(1)</script>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
    expect(html).toContain('<p>Hi</p>')
  })

  it('removes inline event handlers', () => {
    const payloads = [
      '<img src="x" onerror="alert(1)">',
      '<div onload="alert(1)">x</div>',
      '<p onclick="alert(1)">click</p>',
      '<a href="#" onmouseover="alert(1)">hover</a>',
    ]
    for (const payload of payloads) {
      const { html } = parseMarkdownToHtml(payload)
      expect(html).not.toMatch(/\son(error|load|click|mouseover)\s*=/i)
    }
  })

  it('removes javascript: and vbscript: URL schemes', () => {
    for (const scheme of ['javascript:', 'vbscript:']) {
      const { html } = parseMarkdownToHtml(`<a href="${scheme}alert(1)">x</a>`)
      expect(html.toLowerCase()).not.toContain(scheme)
    }
  })

  it('removes data:text/html URLs used as navigable documents', () => {
    const { html } = parseMarkdownToHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')
    expect(html.toLowerCase()).not.toContain('data:text/html')
  })

  it('removes iframe/object/embed/form injection', () => {
    const { html } = parseMarkdownToHtml(
      '<iframe src="https://evil.example"></iframe><object data="x"></object><embed src="x"><form action="x"><input name="a"></form>',
    )
    expect(html).not.toMatch(/<(iframe|object|embed|form|input)\b/i)
  })

  it('keeps HTML-encoded payloads inert as literal text', () => {
    const { html } = parseMarkdownToHtml('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;')
  })

  it('does not throw on malformed or unbalanced HTML', () => {
    expect(() => parseMarkdownToHtml('<p><b>unclosed')).not.toThrow()
    expect(() => parseMarkdownToHtml('<<<>>><script')).not.toThrow()
    expect(() => parseMarkdownToHtml('')).not.toThrow()
  })

  it('preserves legitimate Vietnamese news formatting', () => {
    const raw = [
      '<h2>Thị trường in 3D tại Việt Nam</h2>',
      '<p>Nhu cầu <strong>tăng trưởng</strong> và <em>ổn định</em>.</p>',
      '<ul><li>Mô hình trang trí</li><li>Phụ tùng máy in</li></ul>',
      '<blockquote>Trích dẫn chuyên gia.</blockquote>',
      '<p><a href="https://store3d.vn/tin-tuc">Đọc thêm</a></p>',
    ].join('')
    const { html } = parseMarkdownToHtml(raw)
    expect(html).toContain('<h2')
    expect(html).toContain('Thị trường in 3D tại Việt Nam')
    expect(html).toContain('<strong>tăng trưởng</strong>')
    expect(html).toContain('<em>ổn định</em>')
    expect(html).toContain('<li>Mô hình trang trí</li>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('href="https://store3d.vn/tin-tuc"')
  })

  it('still injects heading ids for the table of contents', () => {
    const { html, headings } = parseMarkdownToHtml(
      '<h2>Giới thiệu</h2><h3>Chi tiết sản phẩm</h3>',
    )
    expect(headings).toHaveLength(2)
    expect(html).toMatch(/<h2 id="gioi-thieu">/)
    expect(html).toMatch(/<h3 id="chi-tiet-san-pham">/)
  })

  it('strips the "srcdoc" attribute that re-introduces HTML', () => {
    const { html } = parseMarkdownToHtml('<div srcdoc="<script>alert(1)</script>">x</div>')
    expect(html.toLowerCase()).not.toContain('srcdoc')
  })
})
