/**
 * groupStockByItem — Group flat stock_levels rows into one entry per item.
 *
 * The inventory page renders item-first (one row per item, expandable to a
 * per-location breakdown) rather than one row per stock_levels record, since
 * per-project locations mean a single item can now have many near-duplicate
 * rows (including quantity-0 leftovers at locations it moved out of).
 */
import type { StockLevel } from '../types'

export interface ItemStockGroup {
  item_id: number
  item: StockLevel['item']
  totalQuantity: number
  /** All stock_levels rows for this item, including quantity-0 ones. */
  locations: StockLevel[]
}

export function groupStockByItem(stockLevels: StockLevel[]): ItemStockGroup[] {
  const map = new Map<number, ItemStockGroup>()

  for (const stock of stockLevels) {
    let group = map.get(stock.item_id)
    if (!group) {
      group = { item_id: stock.item_id, item: stock.item, totalQuantity: 0, locations: [] }
      map.set(stock.item_id, group)
    }
    group.totalQuantity += stock.quantity
    group.locations.push(stock)
  }

  return Array.from(map.values())
}
