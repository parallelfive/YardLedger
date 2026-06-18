// JS-level connectivity detection — no native module, so it works in the
// existing dev build. A lightweight probe of the Supabase auth health endpoint
// (no apikey required, returns 200) tells us whether the backend is reachable.

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';

export async function probeOnline(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
