import { Client } from 'pg';

// Query the local Supabase Postgres directly, so an E2E test can assert the
// DATABASE state after a UI action — the thing that proves the whole chain
// (component -> hook -> service -> PostgREST -> RLS -> trigger). Override the
// connection with E2E_DB_URL when the stack runs on non-default ports.
const DB_URL =
  process.env.E2E_DB_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  return withDb(async (c) => {
    const { rows } = await c.query(sql, params);
    return (rows[0] as T) ?? null;
  });
}
