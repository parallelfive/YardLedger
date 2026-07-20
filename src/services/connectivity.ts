// JS-level connectivity detection, no native module, so it works in the
// existing dev build and on web. Probes the Supabase auth health endpoint to
// tell whether the backend is reachable.

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function probeOnline(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Send the anon apikey: some gateways (e.g. self-hosted Kong) require it
    // even on /auth/v1/health. Treat any non-5xx response as reachable, since
    // even a 401 proves the server answered; only a network failure or a 5xx
    // means we are genuinely offline.
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      signal: controller.signal,
      headers: SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : undefined,
    });
    return res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
