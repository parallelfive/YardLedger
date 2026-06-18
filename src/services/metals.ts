import { supabase } from '../config/supabase';
import { loadJson, saveJson } from './localStore';

export async function fetchMetals() {
  const run = async () => {
    const { data, error } = await supabase
      .from('metals')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  };
  try {
    const data = await run();
    await saveJson('metals', data);
    return data;
  } catch (err) {
    // Offline: serve the last-known catalog so the buy screen still works.
    const cached = await loadJson<Awaited<ReturnType<typeof run>>>('metals');
    if (cached) return cached;
    throw err;
  }
}

export async function createMetal(
  name: string,
  pricePerLb: number,
  categoryId?: string
) {
  const { data, error } = await supabase
    .from('metals')
    .insert({ name, price_per_lb: pricePerLb, category_id: categoryId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMetalPrice(
  metalId: string,
  pricePerLb: number,
  updatedBy: string
) {
  const { data, error } = await supabase
    .from('metals')
    .update({ price_per_lb: pricePerLb, updated_by: updatedBy })
    .eq('id', metalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMetal(
  metalId: string,
  updates: { name?: string; price_per_lb?: number; is_restricted?: boolean },
  updatedBy: string
) {
  const { data, error } = await supabase
    .from('metals')
    .update({ ...updates, updated_by: updatedBy })
    .eq('id', metalId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deactivateMetal(metalId: string) {
  const { error } = await supabase
    .from('metals')
    .update({ is_active: false })
    .eq('id', metalId);
  if (error) throw error;
}

export async function fetchMetalCategories() {
  const run = async () => {
    const { data, error } = await supabase
      .from('metal_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');
    if (error) throw error;
    return data;
  };
  try {
    const data = await run();
    await saveJson('metal_categories', data);
    return data;
  } catch (err) {
    const cached =
      await loadJson<Awaited<ReturnType<typeof run>>>('metal_categories');
    if (cached) return cached;
    throw err;
  }
}

export interface PriceHistoryEntry {
  id: string;
  old_price: number;
  new_price: number;
  created_at: string;
}

export async function logPriceChange(
  metalId: string,
  oldPrice: number,
  newPrice: number,
  changedBy: string
) {
  const { error } = await supabase.from('price_history').insert({
    metal_id: metalId,
    old_price: oldPrice,
    new_price: newPrice,
    changed_by: changedBy,
  });
  // This is the pricing audit trail — don't let a failed write vanish silently.
  if (error) throw error;
}

export async function fetchPriceHistory(
  metalId: string
): Promise<PriceHistoryEntry[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('id, old_price, new_price, created_at')
    .eq('metal_id', metalId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function fetchMetalsByCategory(categoryId: string) {
  const { data, error } = await supabase
    .from('metals')
    .select('*')
    .eq('is_active', true)
    .eq('category_id', categoryId)
    .order('name');
  if (error) throw error;
  return data;
}
