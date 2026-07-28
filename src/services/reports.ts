import { supabase } from '../config/supabase';
import { startOfLocalDayUtc, endOfLocalDayUtc } from '../utils/dateRange';
import { localDateInTz } from '../utils/timezone';
import { isReportOverdue } from '../utils/businessDays';
import { buildNmrldExportCsv } from '../utils/nmrldExport';

// PostgREST caps a single response at ~1000 rows. For unbounded compliance /
// report reads, page through with .range() so a busy yard's state filing (or a
// long report) is never SILENTLY truncated (#45). `build()` must return a fresh
// query each call (filters + order, no range).
const PAGE_SIZE = 1000;
interface Rangeable<T> {
  range(
    from: number,
    to: number
  ): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
}
async function fetchAllPages<T>(build: () => Rangeable<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    out.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return out;
}

// ---------- Daily Summary ----------

export interface DailySummary {
  totalBoughtWeight: number;
  totalBoughtDollars: number;
  totalSoldWeight: number;
  totalSoldRevenue: number;
  grossProfit: number;
  receiptCount: number;
  topMetals: { name: string; weight: number }[];
}

// Daily buy-$ totals for the last `days` days (oldest → newest) — feeds the
// dashboard sparkline.
export async function fetchRecentBuyTotals(
  days = 14,
  timezone = ''
): Promise<number[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  // One extra day of buffer so a receipt near the window edge in a different
  // timezone isn't excluded by the query before day-bucketing.
  since.setDate(since.getDate() - days);
  const data = await fetchAllPages<{ subtotal: number; created_at: string }>(
    () =>
      supabase
        .from('receipts')
        .select('subtotal, created_at')
        .eq('type', 'buy')
        .gte('created_at', since.toISOString())
        .order('id', { ascending: true })
  );
  // Bucket by CALENDAR day, not elapsed-ms / 86.4M. A DST transition in the
  // window makes a day 23 or 25 hours long, so the fixed-day-length math shifts
  // boundary receipts into the wrong bar (#74). Matching local date strings is
  // DST-correct.
  const dayIndex = new Map<string, number>();
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - 1 - i));
    dayIndex.set(localDateInTz(d, timezone), i);
  }
  const buckets = new Array(days).fill(0) as number[];
  for (const r of data) {
    const idx = dayIndex.get(localDateInTz(r.created_at as string, timezone));
    if (idx !== undefined) buckets[idx] += Number(r.subtotal);
  }
  return buckets;
}

export async function fetchDailySummary(
  startDate: string,
  endDate: string
): Promise<DailySummary> {
  const rangeStart = startOfLocalDayUtc(startDate);
  const rangeEnd = endOfLocalDayUtc(endDate);

  // Fetch buy receipts with line items in range (paginated — a busy month can
  // exceed the 1000-row cap and silently undercount the summary) (#45).
  const receipts = await fetchAllPages<{
    id: string;
    subtotal: number;
    line_items: { metal_name: string; weight: number; price_per_lb: number }[];
  }>(() =>
    supabase
      .from('receipts')
      .select('id, subtotal, line_items(metal_name, weight, price_per_lb)')
      .eq('type', 'buy')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
      .order('id', { ascending: true })
  );

  // Fetch sales in range
  const sales = await fetchAllPages<{
    weight: number;
    total_revenue: number;
    profit: number;
  }>(() =>
    supabase
      .from('sales')
      .select('weight, total_revenue, profit')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
      .order('id', { ascending: true })
  );

  let totalBoughtWeight = 0;
  let totalBoughtDollars = 0;
  const metalWeights = new Map<string, number>();

  for (const receipt of receipts ?? []) {
    totalBoughtDollars += Number(receipt.subtotal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const li of (receipt.line_items as any[]) ?? []) {
      const w = Number(li.weight);
      totalBoughtWeight += w;
      metalWeights.set(
        li.metal_name,
        (metalWeights.get(li.metal_name) ?? 0) + w
      );
    }
  }

  let totalSoldWeight = 0;
  let totalSoldRevenue = 0;
  let grossProfit = 0;
  for (const sale of sales ?? []) {
    totalSoldWeight += Number(sale.weight);
    totalSoldRevenue += Number(sale.total_revenue);
    grossProfit += Number(sale.profit);
  }

  const topMetals = Array.from(metalWeights.entries())
    .map(([name, weight]) => ({ name, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);

  return {
    totalBoughtWeight,
    totalBoughtDollars,
    totalSoldWeight,
    totalSoldRevenue,
    grossProfit,
    receiptCount: receipts?.length ?? 0,
    topMetals,
  };
}

// ---------- Inventory Valuation ----------

export interface InventoryValuationRow {
  metalName: string;
  categoryName: string;
  // onHand is a piece count when unit === 'each', pounds otherwise.
  weight: number;
  avgCost: number;
  costValue: number;
  marketPrice: number;
  marketValue: number;
  unrealizedGainLoss: number;
  unit: 'lb' | 'each';
}

export interface InventoryValuationReport {
  rows: InventoryValuationRow[];
  totalCostValue: number;
  totalMarketValue: number;
  totalUnrealized: number;
}

export async function fetchInventoryValuation(): Promise<InventoryValuationReport> {
  const { data, error } = await supabase
    .from('inventory')
    .select(
      'metal_name, weight, avg_cost_per_lb, quantity, avg_cost_per_piece, metals(price_per_lb, pricing_unit, metal_categories(name))'
    )
    // Include per-piece rows (converters, rims) — they carry a piece count, not
    // weight, so a weight-only filter would drop them from the valuation.
    .or('weight.gt.0,quantity.gt.0')
    .order('metal_name');

  if (error) throw error;

  let totalCostValue = 0;
  let totalMarketValue = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: InventoryValuationRow[] = (data ?? []).map((item: any) => {
    const piece =
      item.metals?.pricing_unit === 'each' || Number(item.quantity ?? 0) > 0;
    // For per-piece materials, on-hand + costs are the piece count and the
    // per-piece averages; price_per_lb doubles as the per-piece market price.
    const weight = piece ? Number(item.quantity ?? 0) : Number(item.weight);
    const avgCost = piece
      ? Number(item.avg_cost_per_piece ?? 0)
      : Number(item.avg_cost_per_lb);
    const marketPrice = Number(item.metals?.price_per_lb ?? 0);
    const costValue = weight * avgCost;
    const marketValue = weight * marketPrice;
    const unrealizedGainLoss = marketValue - costValue;

    totalCostValue += costValue;
    totalMarketValue += marketValue;

    return {
      metalName: item.metal_name,
      categoryName: item.metals?.metal_categories?.name ?? 'Uncategorized',
      weight,
      avgCost,
      costValue,
      marketPrice,
      marketValue,
      unrealizedGainLoss,
      unit: piece ? 'each' : 'lb',
    };
  });

  return {
    rows,
    totalCostValue,
    totalMarketValue,
    totalUnrealized: totalMarketValue - totalCostValue,
  };
}

// ---------- Profitability ----------

export interface ProfitabilityRow {
  categoryName: string;
  metalName: string;
  weightBought: number;
  totalBoughtCost: number;
  totalCost: number;
  weightSold: number;
  totalRevenue: number;
  totalProfit: number;
  marginPercent: number;
}

export interface ProfitabilityReport {
  rows: ProfitabilityRow[];
  overallRevenue: number;
  overallCost: number;
  overallProfit: number;
  overallMargin: number;
}

export async function fetchProfitabilityReport(
  startDate: string,
  endDate: string
): Promise<ProfitabilityReport> {
  const rangeStart = startOfLocalDayUtc(startDate);
  const rangeEnd = endOfLocalDayUtc(endDate);

  // Fetch buy line items in range (paginated so a busy month isn't capped) (#45)
  const buyData = await fetchAllPages<Record<string, unknown>>(() =>
    supabase
      .from('line_items')
      .select(
        'metal_id, metal_name, weight, quantity, unit, price_per_lb, receipts!inner(type), metals(metal_categories(name))'
      )
      .eq('receipts.type', 'buy')
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
      .order('id', { ascending: true })
  );

  // Fetch sales in range
  const salesData = await fetchAllPages<Record<string, unknown>>(() =>
    supabase
      .from('sales')
      .select(
        'metal_id, metal_name, weight, cost_basis_per_lb, total_revenue, profit, metals(metal_categories(name))'
      )
      .gte('created_at', rangeStart)
      .lte('created_at', rangeEnd)
      .order('id', { ascending: true })
  );

  // Aggregate by metal_id
  const metalMap = new Map<
    string,
    {
      metalName: string;
      categoryName: string;
      weightBought: number;
      totalBoughtCost: number;
      weightSold: number;
      totalCost: number;
      totalRevenue: number;
      totalProfit: number;
    }
  >();

  // Aggregate buys
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of (buyData as any[]) ?? []) {
    const key = item.metal_id;
    const existing = metalMap.get(key);
    const catName = item.metals?.metal_categories?.name ?? 'Uncategorized';
    const w = Number(item.weight);
    // Per-piece buys carry cost on quantity × price/piece, not weight (which is
    // 0). weightBought stays weight-only; totalBoughtCost is the money spent.
    const amount = item.unit === 'each' ? Number(item.quantity ?? 0) : w;
    const cost = amount * Number(item.price_per_lb);

    if (existing) {
      existing.weightBought += w;
      existing.totalBoughtCost += cost;
    } else {
      metalMap.set(key, {
        metalName: item.metal_name,
        categoryName: catName,
        weightBought: w,
        totalBoughtCost: cost,
        weightSold: 0,
        totalCost: 0,
        totalRevenue: 0,
        totalProfit: 0,
      });
    }
  }

  // Aggregate sales
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sale of (salesData as any[]) ?? []) {
    const key = sale.metal_id;
    const existing = metalMap.get(key);
    const catName = sale.metals?.metal_categories?.name ?? 'Uncategorized';
    const w = Number(sale.weight);
    // Cost of goods = revenue − profit, correct for weight AND per-piece sales
    // (a piece sale has weight 0, so weight × cost_basis would read $0).
    const cogs = Number(sale.total_revenue) - Number(sale.profit);

    if (existing) {
      existing.weightSold += w;
      existing.totalCost += cogs;
      existing.totalRevenue += Number(sale.total_revenue);
      existing.totalProfit += Number(sale.profit);
    } else {
      metalMap.set(key, {
        metalName: sale.metal_name,
        categoryName: catName,
        weightBought: 0,
        totalBoughtCost: 0,
        weightSold: w,
        totalCost: cogs,
        totalRevenue: Number(sale.total_revenue),
        totalProfit: Number(sale.profit),
      });
    }
  }

  let overallRevenue = 0;
  let overallCost = 0;
  let overallProfit = 0;

  const rows: ProfitabilityRow[] = Array.from(metalMap.values())
    .map((m) => {
      overallRevenue += m.totalRevenue;
      overallCost += m.totalCost;
      overallProfit += m.totalProfit;

      return {
        ...m,
        weightBought: m.weightBought,
        totalCost: m.totalCost,
        marginPercent:
          m.totalRevenue > 0 ? (m.totalProfit / m.totalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

  return {
    rows,
    overallRevenue,
    overallCost,
    overallProfit,
    overallMargin:
      overallRevenue > 0 ? (overallProfit / overallRevenue) * 100 : 0,
  };
}

// ---------- Shrinkage ----------

export interface ShrinkageRow {
  metalName: string;
  categoryName: string;
  totalBought: number;
  totalSold: number;
  expectedInventory: number;
  actualInventory: number;
  discrepancy: number;
  discrepancyPercent: number;
}

export async function fetchShrinkageReport(): Promise<ShrinkageRow[]> {
  // All buy line items / sales / inventory — date-unbounded, so these are the
  // most likely to blow past the 1000-row cap; paginate all three (#45).
  const buyData = await fetchAllPages<Record<string, unknown>>(() =>
    supabase
      .from('line_items')
      .select(
        'metal_id, metal_name, weight, receipts!inner(type), metals(metal_categories(name))'
      )
      .eq('receipts.type', 'buy')
      .order('id', { ascending: true })
  );

  const salesData = await fetchAllPages<Record<string, unknown>>(() =>
    supabase
      .from('sales')
      .select('metal_id, weight')
      .order('id', { ascending: true })
  );

  const invData = await fetchAllPages<Record<string, unknown>>(() =>
    supabase
      .from('inventory')
      .select('metal_id, weight')
      .order('id', { ascending: true })
  );

  // Aggregate buys
  const buyMap = new Map<
    string,
    { name: string; categoryName: string; weight: number }
  >();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of (buyData as any[]) ?? []) {
    const existing = buyMap.get(item.metal_id);
    if (existing) {
      existing.weight += Number(item.weight);
    } else {
      buyMap.set(item.metal_id, {
        name: item.metal_name,
        categoryName: item.metals?.metal_categories?.name ?? 'Uncategorized',
        weight: Number(item.weight),
      });
    }
  }

  // Aggregate sales
  const saleMap = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const sale of (salesData as any[]) ?? []) {
    saleMap.set(
      sale.metal_id,
      (saleMap.get(sale.metal_id) ?? 0) + Number(sale.weight)
    );
  }

  // Inventory map
  const invMap = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const inv of (invData as any[]) ?? []) {
    invMap.set(inv.metal_id, Number(inv.weight));
  }

  const rows: ShrinkageRow[] = [];
  for (const [metalId, buy] of buyMap) {
    const totalSold = saleMap.get(metalId) ?? 0;
    const expected = buy.weight - totalSold;
    const actual = invMap.get(metalId) ?? 0;
    const discrepancy = actual - expected;
    const discrepancyPercent =
      expected > 0 ? (discrepancy / expected) * 100 : 0;

    rows.push({
      metalName: buy.name,
      categoryName: buy.categoryName,
      totalBought: buy.weight,
      totalSold,
      expectedInventory: expected,
      actualInventory: actual,
      discrepancy,
      discrepancyPercent,
    });
  }

  return rows
    .filter((r) => r.totalBought > 0)
    .sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));
}

// ---------- Compliance Report ----------

export interface ComplianceReceiptRow {
  id: string;
  receipt_number: string;
  created_at: string;
  customer_name: string;
  seller_name: string | null;
  seller_dob: string | null;
  seller_dl_number: string | null;
  seller_state_of_issue: string | null;
  seller_address: string | null;
  seller_city: string | null;
  seller_state: string | null;
  seller_zip: string | null;
  seller_affirmed: boolean | null;
  seller_no_theft_affirmed: boolean | null;
  vehicle_plate: string | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  transport_vin: string | null;
  cat_converter_numbers: string | null;
  is_catalytic: boolean | null;
  payment_method: string | null;
  hold_until: string | null;
  reported_at: string | null;
  subtotal: number;
  line_items: {
    metal_name: string;
    weight: number;
    total: number;
    is_restricted: boolean;
    is_regulated: boolean;
    // Per-piece lines (converters, rims): unit='each' with a piece count.
    unit?: string | null;
    quantity?: number | null;
    // Joined from the metal — governs the below-a-ton reporting exemption.
    metals?: { is_report_exempt: boolean | null } | null;
  }[];
}

export async function fetchComplianceReport(
  startDate: string,
  endDate: string
): Promise<ComplianceReceiptRow[]> {
  // Paginated so a range with >1000 buys still exports every record (#45).
  return fetchAllPages<ComplianceReceiptRow>(() =>
    supabase
      .from('receipts')
      .select(
        '*, line_items(metal_name, weight, total, is_restricted, is_regulated, unit, quantity, metals(is_report_exempt))'
      )
      .eq('type', 'buy')
      .gte('created_at', startOfLocalDayUtc(startDate))
      .lte('created_at', endOfLocalDayUtc(endDate))
      .order('created_at', { ascending: false })
  );
}

// ---------- NMRLD database export ----------
// NM 57-30-8/9 requires uploading each purchase to the state recycled-metals
// database by the 2nd business day. The pure CSV builder lives in
// utils/nmrldExport (testable, no supabase/RN imports); re-exported here so the
// existing `import { buildNmrldExportCsv } from '../services/reports'` callers
// keep working. ComplianceReceiptRow is a structural superset of NmrldRow.
export { buildNmrldExportCsv };

// The company's NMRLD dealer registration number (identifies the dealer in the
// state file). Stored on company_settings; '' if not yet configured.
export async function fetchNmrldRegistrationNumber(): Promise<string> {
  const { data } = await supabase
    .from('company_settings')
    .select('nmrld_registration_number')
    .limit(1)
    .maybeSingle();
  return (data?.nmrld_registration_number as string | null) ?? '';
}

// The company's IANA timezone (company_settings.timezone) — the legal authority
// for the yard's business day. Used to stamp the state-report datetime in local
// time. '' when unset, which keeps the raw UTC timestamp.
export async function fetchCompanyTimezone(): Promise<string> {
  const { data } = await supabase
    .from('company_settings')
    .select('timezone')
    .limit(1)
    .maybeSingle();
  return (data?.timezone as string | null) ?? '';
}

// The company's compliance jurisdiction (company_settings.state) — selects the
// active state's reporting rules, upload format, and legal copy. '' → the
// default jurisdiction (New Mexico) is used downstream.
export async function fetchCompanyState(): Promise<string> {
  const { data } = await supabase
    .from('company_settings')
    .select('state')
    .limit(1)
    .maybeSingle();
  return (data?.state as string | null) ?? '';
}

export async function exportNmrldCsv(
  startDate: string,
  endDate: string
): Promise<string> {
  const [rows, registration, timezone] = await Promise.all([
    fetchComplianceReport(startDate, endDate),
    fetchNmrldRegistrationNumber(),
    fetchCompanyTimezone(),
  ]);
  return buildNmrldExportCsv(rows, registration, timezone);
}

// ---------- Reporting queue (state / LeadsOnline upload) ----------
// Buy receipts not yet reported to the state database. This is the manual
// bridge today (export -> upload to LeadsOnline -> mark sent) and the exact
// delta the future automated SFTP job will transmit.
export async function fetchUnreportedReceipts(): Promise<
  ComplianceReceiptRow[]
> {
  // Paginated — the full unreported backlog (potentially >1000) is exactly what
  // the state filing must contain, so it can't be capped (#45).
  return fetchAllPages<ComplianceReceiptRow>(() =>
    supabase
      .from('receipts')
      .select(
        '*, line_items(metal_name, weight, total, unit, quantity, is_restricted, is_regulated, metals(is_report_exempt))'
      )
      .eq('type', 'buy')
      .is('reported_at', null)
      .order('created_at', { ascending: true })
  );
}

// Stamp receipts as reported and write an audit-log entry.
export async function markReceiptsReported(
  receiptIds: string[],
  userId: string
): Promise<void> {
  if (receiptIds.length === 0) return;

  const { error } = await supabase
    .from('receipts')
    .update({ reported_at: new Date().toISOString() })
    .in('id', receiptIds);
  if (error) throw error;

  const { error: logError } = await supabase
    .from('compliance_upload_log')
    .insert({
      method: 'manual',
      receipt_count: receiptIds.length,
      status: 'success',
      detail: 'Marked reported after manual state-database upload',
      created_by: userId,
    });
  if (logError) throw logError;
}

// ---------- Reporting status (for the State Reporting screen) ----------
export interface ReportingStatus {
  pending: number;
  // Unreported buys already past the NM 2-business-day deadline (compliance risk).
  overdue: number;
  // Purchase date of the oldest unreported buy (drives the urgency message).
  oldestUnreportedAt: string | null;
  lastUpload: {
    created_at: string;
    receipt_count: number;
    status: string;
    method: string;
  } | null;
}

export async function fetchReportingStatus(): Promise<ReportingStatus> {
  // Pull the unreported buys' purchase dates so we can flag which are past the
  // 2-business-day deadline (business-day math is simplest in JS).
  // Paginated so the pending/overdue counts and oldest-date are accurate past
  // 1000 unreported buys (#45).
  const rows = await fetchAllPages<{ created_at: string }>(() =>
    supabase
      .from('receipts')
      .select('created_at')
      .eq('type', 'buy')
      .is('reported_at', null)
      .order('created_at', { ascending: true })
  );
  const overdue = rows.filter((r) =>
    isReportOverdue(r.created_at as string)
  ).length;

  const { data: log, error: logError } = await supabase
    .from('compliance_upload_log')
    .select('created_at, receipt_count, status, method')
    .order('created_at', { ascending: false })
    .limit(1);
  if (logError) throw logError;

  return {
    pending: rows.length,
    overdue,
    oldestUnreportedAt: rows.length ? (rows[0].created_at as string) : null,
    lastUpload: (log?.[0] as ReportingStatus['lastUpload']) ?? null,
  };
}

// ---------- Material still on a mandatory hold ----------
// Receipts whose hold window has not expired and that have not been disposed —
// these may not be processed/resold yet (NM 57-30-11 / 57-30-2.4).
export interface OnHoldRow {
  id: string;
  receipt_number: string;
  created_at: string;
  hold_until: string;
  is_catalytic: boolean;
}

export async function fetchReceiptsOnHold(): Promise<OnHoldRow[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('id, receipt_number, created_at, hold_until, is_catalytic')
    .eq('type', 'buy')
    .is('disposed_at', null)
    .gt('hold_until', new Date().toISOString())
    .order('hold_until', { ascending: true });

  if (error) throw error;
  return (data ?? []) as OnHoldRow[];
}
