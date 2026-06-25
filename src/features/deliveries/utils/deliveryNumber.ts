/**
 * deliveryNumber.ts — Delivery number generation
 *
 * Format: WP-MMDDYY-XX where XX resets daily (starts at 01 each day)
 * Queries Supabase for today's deliveries to determine the next sequence.
 */
import { supabase } from '../../../lib/supabase'

export async function generateDeliveryNumber(): Promise<string> {
  const now = new Date()

  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const year = String(now.getFullYear()).slice(-2)
  const datePrefix = `${month}${day}${year}`

  const deliveryPrefix = `WP-${datePrefix}`

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const { data, error } = await supabase
    .from('deliveries')
    .select('delivery_number')
    .gte('created_at', startOfDay.toISOString())
    .lt('created_at', endOfDay.toISOString())
    .like('delivery_number', `${deliveryPrefix}-%`)
    .order('delivery_number', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching delivery numbers:', error)
    return `${deliveryPrefix}-01`
  }

  if (!data || data.length === 0) {
    return `${deliveryPrefix}-01`
  }

  const lastNumber = data[0].delivery_number
  const lastSequence = parseInt(lastNumber.split('-')[2], 10)
  const nextSequence = lastSequence + 1

  return `${deliveryPrefix}-${String(nextSequence).padStart(2, '0')}`
}
