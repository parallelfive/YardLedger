import { supabase } from '../config/supabase';

export async function createAccessCode(): Promise<string> {
  const { data, error } = await supabase.rpc('create_access_code');
  if (error) throw error;
  return data as string;
}

export async function validateAccessCode(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('validate_access_code', {
    p_code: code,
  });

  if (error) return false;
  return data === true;
}
