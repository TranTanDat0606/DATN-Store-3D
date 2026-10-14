import { LOW_STOCK_MAX, isLowStock, isOutOfStock } from './stock'

/**
 * Stock presentation contract (Gate B1): low stock is 1..3 units,
 * 0 (or less) is out of stock.
 */

describe('stock contract (Gate B1)', () => {
  it('pins the low-stock upper bound to 3', () => {
    expect(LOW_STOCK_MAX).toBe(3)
  })

  it('treats 1..3 as low stock (inclusive on both ends)', () => {
    expect(isLowStock(1)).toBe(true)
    expect(isLowStock(2)).toBe(true)
    expect(isLowStock(3)).toBe(true)
  })

  it('does not treat 0, negatives or 4+ as low stock', () => {
    expect(isLowStock(0)).toBe(false)
    expect(isLowStock(-1)).toBe(false)
    expect(isLowStock(4)).toBe(false)
  })

  it('treats 0 and negatives as out of stock', () => {
    expect(isOutOfStock(0)).toBe(true)
    expect(isOutOfStock(-2)).toBe(true)
    expect(isOutOfStock(1)).toBe(false)
  })
})
