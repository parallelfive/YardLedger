// Client statement — a per-seller yearly summary of their sales to the yard,
// to hand the customer for their own records (not a tax/1099 document). Pure
// aggregation over a customer's receipts, shared by the desktop + mobile views
// and the print/export helpers (per the "formatting/logic in utils" rule).

export interface StatementLineItem {
  metal_name?: string | null;
  weight?: number | null;
  total?: number | null;
  unit?: string | null;
  quantity?: number | null;
}

export interface StatementReceipt {
  created_at: string;
  receipt_number?: string | null;
  subtotal?: number | null;
  type?: string | null;
  line_items?: StatementLineItem[] | null;
}

export interface StatementMaterial {
  name: string;
  weightLb: number; // pounds (weight-priced lines)
  pieces: number; // count (per-piece lines)
  amount: number; // $ paid for this material in the period
}

export interface StatementLine {
  date: string; // ISO created_at
  receiptNumber: string;
  materials: string; // human summary, e.g. "#1 Copper, Catalytic Converter (2 pcs)"
  amount: number;
}

export interface ClientStatement {
  year: number;
  transactionCount: number;
  totalPaid: number;
  totalWeightLb: number;
  totalPieces: number;
  byMaterial: StatementMaterial[]; // sorted by amount desc
  lines: StatementLine[]; // chronological (oldest first)
}

// Distinct calendar years (desc) present in a customer's BUY receipts — drives
// the year picker. Uses the local year; a statement isn't a legal filing.
export function statementYears(receipts: StatementReceipt[]): number[] {
  const years = new Set<number>();
  for (const r of receipts) {
    if ((r.type ?? 'buy') !== 'buy') continue;
    years.add(new Date(r.created_at).getFullYear());
  }
  return Array.from(years).sort((a, b) => b - a);
}

const amountLabel = (li: StatementLineItem): string =>
  li.unit === 'each'
    ? `${li.metal_name ?? '—'} (${Number(li.quantity ?? 0)} pcs)`
    : `${li.metal_name ?? '—'}`;

export function buildClientStatement(
  receipts: StatementReceipt[],
  year: number
): ClientStatement {
  const inYear = receipts.filter(
    (r) =>
      (r.type ?? 'buy') === 'buy' &&
      new Date(r.created_at).getFullYear() === year
  );

  const mat = new Map<string, StatementMaterial>();
  const lines: StatementLine[] = [];
  let totalPaid = 0;
  let totalWeightLb = 0;
  let totalPieces = 0;

  for (const r of inYear) {
    const amount = Number(r.subtotal ?? 0);
    totalPaid += amount;

    const items = r.line_items ?? [];
    const names: string[] = [];
    for (const li of items) {
      const piece = li.unit === 'each';
      const w = piece ? 0 : Number(li.weight ?? 0);
      const q = piece ? Number(li.quantity ?? 0) : 0;
      totalWeightLb += w;
      totalPieces += q;
      const key = li.metal_name ?? '—';
      const cur = mat.get(key) ?? {
        name: key,
        weightLb: 0,
        pieces: 0,
        amount: 0,
      };
      cur.weightLb += w;
      cur.pieces += q;
      cur.amount += Number(li.total ?? 0);
      mat.set(key, cur);
      names.push(amountLabel(li));
    }

    lines.push({
      date: r.created_at,
      receiptNumber: r.receipt_number ?? '',
      materials: Array.from(new Set(names)).join(', '),
      amount,
    });
  }

  const byMaterial = Array.from(mat.values()).sort(
    (a, b) => b.amount - a.amount
  );
  lines.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    year,
    transactionCount: inYear.length,
    totalPaid,
    totalWeightLb,
    totalPieces,
    byMaterial,
    lines,
  };
}
