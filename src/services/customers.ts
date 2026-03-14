import { supabase } from '../config/supabase';

export interface Customer {
  id: string;
  name: string;
  phone: string;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, phone')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function upsertCustomer(
  name: string,
  phone: string
): Promise<Customer> {
  // Try to find an existing customer with the same name (case-insensitive)
  const { data: existing } = await supabase
    .from('customers')
    .select('id, name, phone')
    .ilike('name', name)
    .limit(1)
    .single();

  if (existing) {
    // Update phone if it changed
    if (phone && phone !== existing.phone) {
      const { data: updated, error } = await supabase
        .from('customers')
        .update({ phone })
        .eq('id', existing.id)
        .select('id, name, phone')
        .single();
      if (error) throw error;
      return updated;
    }
    return existing;
  }

  // Create new customer
  const { data: created, error } = await supabase
    .from('customers')
    .insert({ name, phone })
    .select('id, name, phone')
    .single();
  if (error) throw error;
  return created;
}
