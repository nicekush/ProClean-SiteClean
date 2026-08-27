import { createClient } from '@supabase/supabase-js';
import type { WorkOrder } from '../types';

// Read Supabase environment variables from Vite env or fallback
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== 'YOUR_SUPABASE_URL');

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Table name in Supabase
const TABLE_WORK_ORDERS = 'work_orders';

export async function fetchSupabaseWorkOrders(): Promise<WorkOrder[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE_WORK_ORDERS)
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.warn('Error fetching from Supabase:', error.message);
      return null;
    }

    if (data && Array.isArray(data) && data.length > 0) {
      return data.map((row: any) => row.payload ? { ...row.payload, id: row.id } : row as WorkOrder);
    }
    return [];
  } catch (err) {
    console.warn('Supabase request failed:', err);
    return null;
  }
}

export async function syncWorkOrderToSupabase(order: WorkOrder): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from(TABLE_WORK_ORDERS)
      .upsert({
        id: order.id,
        sap_code: order.sapCode || '',
        equipo_correa: order.equipoCorrea || '',
        status: order.status,
        payload: order,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error saving to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to sync to Supabase:', err);
    return false;
  }
}

export async function syncAllWorkOrdersToSupabase(orders: WorkOrder[]): Promise<boolean> {
  if (!supabase) return false;
  try {
    const rows = orders.map(order => ({
      id: order.id,
      sap_code: order.sapCode || '',
      equipo_correa: order.equipoCorrea || '',
      status: order.status,
      payload: order,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from(TABLE_WORK_ORDERS)
      .upsert(rows);

    if (error) {
      console.error('Error bulk saving to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to bulk sync to Supabase:', err);
    return false;
  }
}

export async function deleteSupabaseWorkOrder(id: string): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from(TABLE_WORK_ORDERS)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to delete from Supabase:', err);
    return false;
  }
}
