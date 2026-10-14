/**
 * Stock presentation contract (Gate B1, approved): "low stock" is 1..3 units,
 * 0 (or less) means out of stock. Single source of truth for the product-card
 * states that land in Gate B2+.
 */

export const LOW_STOCK_MAX = 3

export function isOutOfStock(stock: number): boolean {
  return stock <= 0
}

export function isLowStock(stock: number): boolean {
  return stock >= 1 && stock <= LOW_STOCK_MAX
}
