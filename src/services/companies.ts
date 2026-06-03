import { supabase } from '../config/supabase';
import type { Company } from '../types';

export async function fetchCurrentCompany(): Promise<Company | null> {
  const { data } = await supabase
    .from('companies')
    .select('id, name, prefix')
    .maybeSingle();

  return data ?? null;
}

export async function updateCompany(
  companyId: string,
  updates: { name?: string }
): Promise<Company> {
  const { data, error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', companyId)
    .select('id, name, prefix')
    .single();

  if (error) throw error;
  return data;
}
