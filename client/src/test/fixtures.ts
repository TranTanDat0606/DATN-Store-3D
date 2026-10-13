import type { CartItem } from '@/contexts/CartContext'
import type { Category, Product, User } from '@/types'

/**
 * Deterministic fixtures (Gate W2.2). Hand-written typed constants pinned to a
 * single timestamp — no factory/faker randomness, no wall-clock drift.
 * Expected values in tests must come from these literals (independent source),
 * never from re-running the app's own formatters.
 */

export const NOW = '2026-10-14T09:00:00.000Z'

export const CATEGORY_FIXTURES: Category[] = [
  {
    _id: 'cat-1',
    name: 'Mô hình nhân vật',
    slug: 'mo-hinh-nhan-vat',
    image: '',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    _id: 'cat-2',
    name: 'Mô hình xe tăng',
    slug: 'mo-hinh-xe-tang',
    image: '',
    createdAt: NOW,
    updatedAt: NOW,
  },
]

export const PRODUCT_IN_STOCK: Product = {
  _id: 'prod-1',
  name: 'Mô hình Rồng Phượng Hoàng',
  slug: 'mo-hinh-rong-phuong-hoang',
  description: 'Mô hình in 3D chi tiết cao, lắp ráp thủ công.',
  images: ['https://example.com/rong-phuong-hoang.png'],
  category: CATEGORY_FIXTURES[0],
  material: 'PLA',
  printerType: 'FDM',
  size: '20cm',
  stock: 5,
  originalPrice: 1_500_000,
  salePrice: 1_290_000,
  rating: 4.8,
  reviewCount: 12,
  status: 'active',
  featured: true,
  createdAt: NOW,
  updatedAt: NOW,
}

export const PRODUCT_OUT_OF_STOCK: Product = {
  ...PRODUCT_IN_STOCK,
  _id: 'prod-2',
  name: 'Mô hình Hỏa Long',
  slug: 'mo-hinh-hoa-long',
  stock: 0,
  featured: false,
}

export const SECOND_CATEGORY_PRODUCT: Product = {
  ...PRODUCT_IN_STOCK,
  _id: 'prod-3',
  name: 'Mô hình Xe tăng Model T-90',
  slug: 'mo-hinh-xe-tang-t-90',
  category: CATEGORY_FIXTURES[1],
  stock: 3,
}

/** vi-VN VND rendering of PRODUCT_IN_STOCK.salePrice (1290000) → "1.290.000 ₫". */
export const SALE_PRICE_TEXT = /1\.290\.000/
/** vi-VN VND rendering of PRODUCT_IN_STOCK.originalPrice (1500000) → "1.500.000 ₫". */
export const ORIGINAL_PRICE_TEXT = /1\.500\.000/

export const USER_FIXTURE: User = {
  _id: 'user-1',
  fullname: 'Nguyễn Văn Test',
  email: 'khach-viet@example.com',
  phone: '0900000001',
  role: 'customer',
  active: true,
  createdAt: NOW,
  updatedAt: NOW,
}

/** Envelope shape the server returns for GET /auth/me (ApiResponse<User>). */
export const authMeAuthenticatedHandler = (user: User = USER_FIXTURE) => ({
  success: true,
  message: 'OK',
  data: user,
})

/** localStorage shape used by CartContext (key `store3d-cart`). */
export const CART_ITEM_FIXTURE: CartItem = {
  productId: PRODUCT_IN_STOCK._id,
  name: PRODUCT_IN_STOCK.name,
  slug: PRODUCT_IN_STOCK.slug,
  image: PRODUCT_IN_STOCK.images[0],
  price: PRODUCT_IN_STOCK.salePrice,
  quantity: 2,
  stock: PRODUCT_IN_STOCK.stock,
}

export const CART_STORAGE_KEY = 'store3d-cart'
export const THEME_STORAGE_KEY = 'store3d-theme'
