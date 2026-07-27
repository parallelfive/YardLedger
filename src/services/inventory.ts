import { supabase } from '../config/supabase';
import { loadJson, saveJson } from './localStore';

export async function fetchInventory() {
  const run = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select(
        '*, metals(name, price_per_lb, pricing_unit, is_restricted, is_regulated, is_catalytic, category_id, metal_categories(name))'
      )
      // On hand = has weight OR a piece count (per-piece materials carry no weight).
      .or('weight.gt.0,quantity.gt.0')
      .order('metal_name');
    if (error) throw error;
    return data;
  };
  try {
    const data = await run();
    await saveJson('inventory', data);
    return data;
  } catch (err) {
    // Offline / unreachable: serve the last-known inventory so the sell screen
    // still renders. Only fall back when there's actually a cache.
    const cached = await loadJson<Awaited<ReturnType<typeof run>>>('inventory');
    if (cached) return cached;
    throw err;
  }
}

export async function fetchInventoryByMetal(metalId: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('metal_id', metalId)
    .single();
  if (error) throw error;
  return data;
}
