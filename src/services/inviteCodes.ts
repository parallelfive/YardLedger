import { supabase } from '../config/supabase';
import type { UserRole } from '../types';

export interface InviteCode {
  id: string;
  code: string;
  role: UserRole;
  is_used: boolean;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export async function createInviteCode(role: UserRole): Promise<string> {
  const { data, error } = await supabase.rpc('create_invite_code', {
    p_role: role,
  });
  if (error) throw error;
  return data as string;
}

export async function listInviteCodes(): Promise<InviteCode[]> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('id, code, role, is_used, used_at, expires_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InviteCode[];
}

export async function deleteInviteCode(id: string): Promise<void> {
  const { error } = await supabase.from('invite_codes').delete().eq('id', id);
  if (error) throw error;
}
