import { supabase } from '../config/supabase';

// Open a short admin-elevation window by proving an admin/owner PIN. Privileged
// DB writes are gated on an active window server-side (has_admin_elevation);
// see migrations 20260618000002-4. Returns the window's expiry as epoch ms.
// Throws on a bad/insufficient PIN (the function raises 'Wrong admin passcode').
export async function elevateAdmin(
  pin: string,
  requireOwner = false
): Promise<number> {
  const { data, error } = await supabase.rpc('admin_elevate', {
    p_pin: pin,
    p_owner: requireOwner,
  });
  if (error) throw error;
  return new Date(data as string).getTime();
}
