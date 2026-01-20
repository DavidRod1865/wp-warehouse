import { supabase } from '../lib/supabase';
import type { Address } from '../types/address';

export interface DriverDeliverySummary {
  id: number;
  delivery_number: string;
  driver_id?: string | null;
  status: string;
  created_at: string;
  delivered_at: string | null;
  from_address: Address;
  to_address: Address;
  truck_sortly_folder_id?: number | null;
  truck_name: string | null;
  projects?: { name: string } | null;
}

export interface DriverDeliveryDetail extends DriverDeliverySummary {
  activity_log?: Array<{
    timestamp: string;
    action: string;
    user_id?: string;
    user_email?: string;
    details?: Record<string, unknown>;
  }>;
}

export interface DeliveryItem {
  id: number;
  sortly_item_id: number | null;
  item_name: string;
  quantity: number;
  notes: string | null;
  custom_attribute_values?: Array<{
    custom_attribute_id: number;
    custom_attribute_name: string;
    value: string;
  }> | null;
}

export interface DeliveryConfirmation {
  id: number;
  delivery_id: number;
  driver_id: string;
  completed_at: string;
  signed_by_name: string;
  signature_url: string | null;
  signature_storage_path: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export async function fetchDriverDeliveriesByFolder(truckFolderId: number) {
  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `
      id,
      delivery_number,
      driver_id,
      status,
      created_at,
      delivered_at,
      from_address,
      to_address,
      truck_sortly_folder_id,
      truck_name,
      projects (
        name
      )
    `
    )
    .eq('truck_sortly_folder_id', truckFolderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as unknown as DriverDeliverySummary[];
}

export async function fetchDriverDeliveryDetail(deliveryId: number) {
  const { data, error } = await supabase
    .from('deliveries')
    .select(
      `
      id,
      delivery_number,
      driver_id,
      status,
      created_at,
      delivered_at,
      from_address,
      to_address,
      truck_sortly_folder_id,
      truck_name,
      activity_log,
      projects (
        name
      )
    `
    )
    .eq('id', deliveryId)
    .single();

  if (error) throw error;
  return data as unknown as DriverDeliveryDetail;
}

export async function fetchDeliveryItems(deliveryId: number) {
  const { data, error } = await supabase
    .from('delivery_items')
    .select('*')
    .eq('delivery_id', deliveryId);

  if (error) throw error;
  return (data || []) as DeliveryItem[];
}

export async function fetchDeliveryConfirmation(deliveryId: number) {
  const { data, error } = await supabase
    .from('delivery_confirmations')
    .select('*')
    .eq('delivery_id', deliveryId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return (data || null) as DeliveryConfirmation | null;
}

export async function uploadSignatureImage(options: {
  deliveryId: number;
  driverId: string;
  file: Blob;
}) {
  const { deliveryId, driverId, file } = options;
  const filePath = `${deliveryId}/${driverId}/${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from('delivery-signatures')
    .upload(filePath, file, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('delivery-signatures')
    .getPublicUrl(filePath);

  return {
    signature_storage_path: filePath,
    signature_url: data.publicUrl,
  };
}
