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

  // Distinguish a clean rejection (wrong code → data false) from a real error
  // such as the brute-force lockout, which validate_access_code raises. The old
  // `return false` collapsed the lockout into a generic "invalid code", hiding
  // the security state from the operator. Surface it so the caller can show it.
  if (error) throw new Error(error.message);
  return data === true;
}
