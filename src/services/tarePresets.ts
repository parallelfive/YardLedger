import { supabase } from '../config/supabase';

// A saved tare (empty vehicle/container weight) an operator can reuse across
// buys. Company scoping is enforced by RLS + the column default, so queries
// here never filter on company_id explicitly.
export interface TarePreset {
  id: string;
  name: string;
  tare_weight: number;
}

export async function fetchTarePresets(): Promise<TarePreset[]> {
  const { data, error } = await supabase
    .from('tare_presets')
    .select('id, name, tare_weight')
    .order('name');
  if (error) throw error;
  return (data ?? []) as TarePreset[];
}

export async function createTarePreset(input: {
  name: string;
  tareWeight: number;
  createdBy?: string | null;
}): Promise<TarePreset> {
  const { data, error } = await supabase
    .from('tare_presets')
    .insert({
      name: input.name.trim(),
      tare_weight: input.tareWeight,
      created_by: input.createdBy ?? null,
    })
    .select('id, name, tare_weight')
    .single();
  if (error) throw error;
  return data as TarePreset;
}

export async function deleteTarePreset(id: string): Promise<void> {
  const { error } = await supabase.from('tare_presets').delete().eq('id', id);
  if (error) throw error;
}
