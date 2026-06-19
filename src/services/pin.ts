import { supabase } from '../config/supabase';

export interface PinIdentity {
  user_id: string;
  name: string;
  role: 'worker' | 'admin' | 'owner';
}

/** Set/replace the current user's 4-digit shift PIN. Throws on a non-4-digit
 * PIN or one already used by another staff member in the company. */
export async function setPin(pin: string): Promise<void> {
  const { error } = await supabase.rpc('set_pin', { p_pin: pin });
  if (error) throw error;
}

/** Validate a PIN against the device's company staff. Returns the matched
 * (attributed) identity, or throws ('Wrong passcode' / lockout message). */
export async function validatePin(pin: string): Promise<PinIdentity> {
  const { data, error } = await supabase.rpc('validate_pin', { p_pin: pin });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as PinIdentity | undefined;
  if (!row) throw new Error('Wrong passcode');
  return row;
}
