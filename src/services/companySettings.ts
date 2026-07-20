import { supabase } from '../config/supabase';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { updateCompany } from './companies';

export interface CompanySettings {
  id: string;
  company_name: string;
  address: string;
  phone: string;
  logo_url: string | null;
  updated_at: string;
  // State-configurable compliance rules (NM defaults; see migration 14).
  state: string;
  general_hold_hours: number;
  cat_converter_hold_days: number;
  cat_converter_check_only: boolean;
  general_retention_years: number;
  cat_converter_retention_years: number;
  // IANA timezone of the yard — drives legal receipt dates (migration 7).
  timezone: string;
  // The yard's regulatory identity for reports/records (migration 20260708…).
  license_number: string;
  ein: string;
  registry_id: string;
}

export async function fetchCompanySettings(): Promise<CompanySettings | null> {
  const { data } = await supabase
    .from('company_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function updateCompanySettings(
  updates: {
    company_name?: string;
    address?: string;
    phone?: string;
    state?: string;
    general_hold_hours?: number;
    cat_converter_hold_days?: number;
    cat_converter_check_only?: boolean;
    general_retention_years?: number;
    cat_converter_retention_years?: number;
    timezone?: string;
    license_number?: string;
    ein?: string;
    registry_id?: string;
  },
  userId: string,
  settingsId?: string | null
): Promise<CompanySettings> {
  // company_settings.company_name and companies.name had drifted apart — the
  // companies row is the canonical display name (Redux reads it), so keep the
  // two in lockstep whenever the name is edited here.
  if (updates.company_name !== undefined) {
    const { data: companyId } = await supabase.rpc('current_company_id');
    if (companyId) {
      await updateCompany(companyId as string, { name: updates.company_name });
    }
  }

  // Resolve which row to update: the caller's id, or the current company's
  // existing settings row (RLS scopes the lookup to this company). A blind
  // insert trips the one-row-per-company unique constraint (409) — the desktop
  // editCompany doesn't pass an id, so we must find the row before writing.
  let targetId = settingsId ?? null;
  if (!targetId) {
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    targetId = existing?.id ?? null;
  }

  if (targetId) {
    const { data, error } = await supabase
      .from('company_settings')
      .update({ ...updates, updated_by: userId })
      .eq('id', targetId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // No row yet for this company — create the first one.
  const { data, error } = await supabase
    .from('company_settings')
    .insert({ ...updates, updated_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadCompanyLogo(
  imageUri: string,
  userId: string,
  settingsId: string
): Promise<string> {
  // Scope the path by company so RLS isolates each yard's logo and one
  // tenant can't overwrite another's (the bucket stays public-read).
  const { data: companyId, error: companyErr } =
    await supabase.rpc('current_company_id');
  if (companyErr || !companyId) {
    throw companyErr ?? new Error('No current company for logo upload');
  }
  const filePath = `${companyId}/logo_${Date.now()}.jpg`;

  // Read image as base64
  const file = new File(imageUri);
  const base64 = await file.base64();

  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(filePath, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('company-logos').getPublicUrl(filePath);

  // Update company_settings with logo URL
  const { error: updateError } = await supabase
    .from('company_settings')
    .update({ logo_url: publicUrl, updated_by: userId })
    .eq('id', settingsId);

  if (updateError) throw updateError;

  return publicUrl;
}
