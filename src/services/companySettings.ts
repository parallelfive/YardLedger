import { supabase } from '../config/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

export interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string;
  logo_url: string | null;
  updated_at: string;
}

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) throw error;
  return data;
}

export async function updateCompanySettings(
  updates: {
    company_name?: string;
    address?: string;
    phone?: string;
  },
  userId: string
): Promise<CompanySettings> {
  // Get the single row
  const { data: existing, error: fetchError } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('company_settings')
    .update({ ...updates, updated_by: userId })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function uploadCompanyLogo(
  imageUri: string,
  userId: string
): Promise<string> {
  const fileName = `logo_${Date.now()}.jpg`;

  // Read image as base64
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: 'base64',
  });

  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(fileName, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('company-logos').getPublicUrl(fileName);

  // Update company_settings with logo URL
  const { data: existing, error: fetchError } = await supabase
    .from('company_settings')
    .select('id')
    .limit(1)
    .single();

  if (fetchError) throw fetchError;

  const { error: updateError } = await supabase
    .from('company_settings')
    .update({ logo_url: publicUrl, updated_by: userId })
    .eq('id', existing.id);

  if (updateError) throw updateError;

  return publicUrl;
}
