import { Link } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { Logo } from '@/components/common/logo'

/**
 * Store shell footer (Gate B1, approved content contract):
 *  - only factual copy — no free-shipping claims, no invented address,
 *    hotline, e-mail, opening hours, policies or unverifiable social links
 *  - category links are the REAL categories from the API
 *  - every link targets a route that exists in the router
 */
export function Footer() {
  const categories = useCategories()
  const year = new Date().getFullYear()

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Link to="/" className="inline-flex" aria-label="Store 3D — Trang chủ">
            <Logo />
          </Link>
          <p className="text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed">
            Figurine, đồ trang trí và mô hình kiến trúc được in 3D theo từng lớp vật
            liệu — PLA, PETG, ABS và resin.
          </p>
        </div>

        {categories.length > 0 && (
          <nav aria-labelledby="footer-categories">
            <h2 id="footer-categories" className="text-sm font-semibold">
              Danh mục
            </h2>
            <ul className="mt-4 space-y-2.5">
              {categories.map((c) => (
                <li key={c._id}>
                  <Link
                    to={`/san-pham?categorySlug=${encodeURIComponent(c.slug)}`}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className="text-sm font-semibold">
            Khám phá
          </h2>
          <ul className="mt-4 space-y-2.5">
            <li>
              <Link to="/san-pham" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Sản phẩm
              </Link>
            </li>
            <li>
              <Link to="/tin-tuc" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Tin tức
              </Link>
            </li>
            <li>
              <Link to="/lien-he" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Liên hệ
              </Link>
            </li>
            <li>
              <Link to="/tai-khoan" className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                Tài khoản
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-sm font-semibold">Thanh toán</h2>
          <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
            Đơn hàng được thanh toán khi nhận hàng (COD) hoặc chuyển khoản ngân hàng
            qua mã VietQR.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="Phương thức thanh toán">
            {['VietQR', 'Chuyển khoản', 'COD'].map((method) => (
              <li
                key={method}
                className="border-border text-muted-foreground rounded-md border px-2.5 py-1 text-xs font-medium"
              >
                {method}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t">
        <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-1 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {year} Store 3D — Mô hình in 3D.</p>
          <p>Vận chuyển trên toàn quốc.</p>
        </div>
      </div>
    </footer>
  )
}
