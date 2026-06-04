import { supabase } from '../config/supabase';

export async function fetchInventory() {
  const { data, error } = await supabase
    .from('inventory')
    .select(
      '*, metals(name, price_per_lb, is_restricted, is_catalytic, category_id, metal_categories(name))'
    )
    .gt('weight', 0)
    .order('metal_name');
  if (error) throw error;
  return data;
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
