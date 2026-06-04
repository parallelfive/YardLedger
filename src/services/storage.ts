import { supabase } from '../config/supabase';

const PRIVATE_BUCKET = 'customer-ids';

// PII photos (IDs, seller/material shots) are stored in a private bucket as
// object PATHS, not URLs. We mint a short-lived signed URL on demand at
// render/print time instead of persisting a long-lived bearer URL that both
// leaks (anyone with the link) and expires before the retention period ends.
//
// Backward compatible: a stored value that is already a full URL (legacy rows
// that saved a signed URL, or a base64 data URI) is returned as-is.
export async function signPrivatePath(
  value: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!value) return null;
  if (value.startsWith('http') || value.startsWith('data:')) return value;
  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(value, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}
