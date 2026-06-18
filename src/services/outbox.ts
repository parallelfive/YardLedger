import { loadJson, saveJson } from './localStore';
import { createReceipt, type CreateReceiptParams } from './receipts';
import { createSale, type CreateSaleParams } from './sales';

// Offline write queue. Buys/sales created while the device is offline are
// appended here (as the exact params the online services take) and replayed in
// order when connectivity returns. Persisted via localStore (expo-file-system).

const KEY = 'outbox';

export type OutboxItem =
  | {
      id: string;
      kind: 'receipt';
      createdAt: number;
      params: CreateReceiptParams;
    }
  | { id: string; kind: 'sale'; createdAt: number; params: CreateSaleParams };

async function readAll(): Promise<OutboxItem[]> {
  return (await loadJson<OutboxItem[]>(KEY)) ?? [];
}

async function writeAll(items: OutboxItem[]): Promise<void> {
  await saveJson(KEY, items);
}

// App runtime allows Date.now()/Math.random(); vary by index for uniqueness.
function newId(index: number): string {
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}-${index}`;
}

export async function outboxCount(): Promise<number> {
  return (await readAll()).length;
}

export async function enqueueReceipt(
  params: CreateReceiptParams
): Promise<number> {
  const items = await readAll();
  items.push({
    id: newId(items.length),
    kind: 'receipt',
    createdAt: Date.now(),
    params,
  });
  await writeAll(items);
  return items.length;
}

export async function enqueueSale(params: CreateSaleParams): Promise<number> {
  const items = await readAll();
  items.push({
    id: newId(items.length),
    kind: 'sale',
    createdAt: Date.now(),
    params,
  });
  await writeAll(items);
  return items.length;
}

export interface ReplayResult {
  succeeded: number;
  failed: { item: OutboxItem; error: string }[];
  remaining: number;
}

function isNetworkError(msg: string): boolean {
  return /network request failed|fetch failed|timed? ?out|Failed to fetch|aborted/i.test(
    msg
  );
}

// Replay queued writes in order. A transient (network) failure stops the run and
// preserves the rest of the queue in order. A permanent rejection (e.g. an
// oversell, or a price that's no longer market so it reads as an unauthorized
// override) is dropped from the queue and reported so the operator can re-key it.
export async function replayOutbox(): Promise<ReplayResult> {
  const items = await readAll();
  const failed: { item: OutboxItem; error: string }[] = [];
  let succeeded = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      if (item.kind === 'receipt') await createReceipt(item.params);
      else await createSale(item.params);
      succeeded++;
    } catch (err) {
      const msg = (err as Error).message ?? 'Unknown error';
      if (isNetworkError(msg)) {
        // Still offline — keep this item and everything after it, in order.
        const keep = items.slice(i);
        await writeAll(keep);
        return { succeeded, failed, remaining: keep.length };
      }
      failed.push({ item, error: msg });
    }
  }

  await writeAll([]);
  return { succeeded, failed, remaining: 0 };
}
