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

// Drop the company's active elevation window(s). Best-effort: called when the
// active identity changes so an admin's window can't outlive their presence.
export async function clearElevation(): Promise<void> {
  await supabase.rpc('clear_elevation');
}

// Whether the signed-in user has a PIN set (gates the set-admin-PIN prompt).
export async function currentUserHasPin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('current_user_has_pin');
  if (error) throw error;
  return data === true;
}
