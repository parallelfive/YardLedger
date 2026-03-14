import { supabase } from '../config/supabase';

export async function fetchMetals() {
  const { data, error } = await supabase
    .from('metals')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data;
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
  updates: { name?: string; price_per_lb?: number },
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
  const { data, error } = await supabase
    .from('metal_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  if (error) throw error;
  return data;
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
