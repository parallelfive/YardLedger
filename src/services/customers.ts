import { supabase } from '../config/supabase';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  drivers_license: string;
  dl_photo_uri: string | null;
  address: string;
  dob: string | null;
  notes: string;
  is_flagged: boolean;
  flag_reason: string;
  created_at: string;
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function fetchCustomerById(
  customerId: string
): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', customerId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAllCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchCustomerReceipts(customerId: string) {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, line_items(*)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
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
    .select('*')
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
        .select('*')
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
    .select('*')
    .single();
  if (error) throw error;
  return created;
}

export async function updateCustomer(
  customerId: string,
  updates: {
    name?: string;
    phone?: string;
    drivers_license?: string;
    address?: string;
    dob?: string | null;
    notes?: string;
    is_flagged?: boolean;
    flag_reason?: string;
  }
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', customerId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomerIdPhoto(
  customerId: string,
  photoUrl: string
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ dl_photo_uri: photoUrl })
    .eq('id', customerId);
  if (error) throw error;
}

export async function uploadCustomerIdPhoto(
  customerId: string,
  imageUri: string
): Promise<string> {
  // Scope the storage path by company so RLS can isolate each yard's
  // private ID photos. current_company_id() is the same helper the RLS
  // policies use, so the path and the policy stay in lockstep.
  const { data: companyId, error: companyErr } =
    await supabase.rpc('current_company_id');
  if (companyErr || !companyId) {
    throw companyErr ?? new Error('No current company for ID upload');
  }
  const filePath = `${companyId}/${customerId}_${Date.now()}.jpg`;

  const file = new File(imageUri);
  const base64 = await file.base64();

  const { error: uploadError } = await supabase.storage
    .from('customer-ids')
    .upload(filePath, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // Bucket is private (PII). Return a long-lived signed URL rather than
  // getPublicUrl(), which does not authenticate against a private bucket.
  const { data: signed, error: signErr } = await supabase.storage
    .from('customer-ids')
    .createSignedUrl(filePath, 60 * 60 * 24 * 365);
  if (signErr || !signed) throw signErr ?? new Error('Failed to sign ID URL');
  const publicUrl = signed.signedUrl;

  // Save the URL to the customer record
  const { error: updateError } = await supabase
    .from('customers')
    .update({ dl_photo_uri: publicUrl })
    .eq('id', customerId);

  if (updateError) throw updateError;

  return publicUrl;
}
