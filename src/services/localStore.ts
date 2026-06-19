import { File, Paths } from 'expo-file-system';

// Tiny JSON persistence on top of expo-file-system (already a dependency — no
// new native module). Used for the offline read cache and the write outbox.
// All operations are best-effort: a failure never throws into the caller, so a
// cache/outbox hiccup can't break a screen.

function fileFor(key: string): File {
  return new File(Paths.document, `yl_${key}.json`);
}

export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const f = fileFor(key);
    if (!f.exists) return null;
    const text = await f.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    const f = fileFor(key);
    if (!f.exists) f.create();
    f.write(JSON.stringify(value));
  } catch {
    // best-effort persistence — ignore write failures
  }
}
