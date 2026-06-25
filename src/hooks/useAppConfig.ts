/**
 * useAppConfig — Fetches configurable settings from the app_config table
 *
 * Replaces hardcoded constants (like TRUCKS_FOLDER_ID) with database-driven
 * values that can be updated without redeploying.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface AppConfig {
  mainWarehouseFolderId: number | null
  deliveryTrucksFolderId: number | null
}

async function fetchAppConfig(): Promise<AppConfig> {
  const { data, error } = await supabase
    .from('app_config')
    .select('key, value')
    .in('key', ['main_warehouse_folder_id', 'delivery_trucks_folder_id'])

  if (error) throw error

  const configMap = new Map<string, unknown>(
    (data || []).map((r: { key: string; value: unknown }) => [r.key, r.value])
  )

  return {
    mainWarehouseFolderId: toNumber(configMap.get('main_warehouse_folder_id')),
    deliveryTrucksFolderId: toNumber(configMap.get('delivery_trucks_folder_id')),
  }
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === 'null') return null
  const n = Number(val)
  return Number.isFinite(n) ? n : null
}

export function useAppConfig() {
  return useQuery({
    queryKey: ['appConfig'],
    queryFn: fetchAppConfig,
    staleTime: 30 * 60 * 1000, // 30 min — these rarely change
  })
}
