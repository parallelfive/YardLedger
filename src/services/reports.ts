import { supabase } from '../config/supabase';
import { startOfLocalDayUtc, endOfLocalDayUtc } from '../utils/dateRange';
import { isReportOverdue } from '../utils/businessDays';

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
export async function fetchRecentBuyTotals(days = 14): Promise<number[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));
  const { data, error } = await supabase
    .from('receipts')
    .select('subtotal, created_at')
    .eq('type', 'buy')
    .gte('created_at', since.toISOString());
  if (error) throw error;
  const buckets = new Array(days).fill(0) as number[];
  const startMs = since.getTime();
  const dayMs = 86400000;
  for (const r of data ?? []) {
    const idx = Math.floor(
      (new Date(r.created_at as string).getTime() - startMs) / dayMs
    );
    if (idx >= 0 && idx < days) buckets[idx] += Number(r.subtotal);
  }
  return buckets;
}

export async function fetchDailySummary(
  startDate: string,
  endDate: string
): Promise<DailySummary> {
  const rangeStart = startOfLocalDayUtc(startDate);
  const rangeEnd = endOfLocalDayUtc(endDate);

  // Fetch buy receipts with line items in range
  const { data: receipts, error: receiptsError } = await supabase
    .from('receipts')
    .select('id, subtotal, line_items(metal_name, weight, price_per_lb)')
    .eq('type', 'buy')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);
  if (receiptsError) throw receiptsError;

  // Fetch sales in range
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('weight, total_revenue, profit')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);
  if (salesError) throw salesError;

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
  weight: number;
  avgCost: number;
  costValue: number;
  marketPrice: number;
  marketValue: number;
  unrealizedGainLoss: number;
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
      'metal_name, weight, avg_cost_per_lb, metals(price_per_lb, metal_categories(name))'
    )
    .gt('weight', 0)
    .order('metal_name');

  if (error) throw error;

  let totalCostValue = 0;
  let totalMarketValue = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: InventoryValuationRow[] = (data ?? []).map((item: any) => {
    const weight = Number(item.weight);
    const avgCost = Number(item.avg_cost_per_lb);
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

  // Fetch buy line items in range
  const { data: buyData, error: buyError } = await supabase
    .from('line_items')
    .select(
      'metal_id, metal_name, weight, price_per_lb, receipts!inner(type), metals(metal_categories(name))'
    )
    .eq('receipts.type', 'buy')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);
  if (buyError) throw buyError;

  // Fetch sales in range
  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select(
      'metal_id, metal_name, weight, cost_basis_per_lb, total_revenue, profit, metals(metal_categories(name))'
    )
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);
  if (salesError) throw salesError;

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
    const cost = w * Number(item.price_per_lb);

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
    const cogs = w * Number(sale.cost_basis_per_lb);

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
  // All buy line items aggregated by metal
  const { data: buyData, error: buyError } = await supabase
    .from('line_items')
    .select(
      'metal_id, metal_name, weight, receipts!inner(type), metals(metal_categories(name))'
    )
    .eq('receipts.type', 'buy');
  if (buyError) throw buyError;

  // All sales aggregated by metal
  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('metal_id, weight');
  if (salesError) throw salesError;

  // Current inventory
  const { data: invData, error: invError } = await supabase
    .from('inventory')
    .select('metal_id, weight');
  if (invError) throw invError;

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
  }[];
}

export async function fetchComplianceReport(
  startDate: string,
  endDate: string
): Promise<ComplianceReceiptRow[]> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, line_items(metal_name, weight, total, is_restricted)')
    .eq('type', 'buy')
    .gte('created_at', startOfLocalDayUtc(startDate))
    .lte('created_at', endOfLocalDayUtc(endDate))
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ComplianceReceiptRow[];
}

// ---------- NMRLD database export ----------
// NM 57-30-8/9 requires uploading each purchase to the state recycled-metals
// database by the 2nd business day. This produces one CSV row per metal line
// with the seller/vehicle/material/payment data the upload requires.

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// IMPORTANT: keep this column set IN SYNC with the edge function
// supabase/functions/report-to-state/index.ts (HEADERS + buildCsv) so the manual
// export and the automated SFTP upload file the IDENTICAL record.
const NMRLD_HEADERS = [
  'nmrld_registration_number',
  'receipt_number',
  'transaction_datetime',
  'seller_name',
  'seller_dob',
  'seller_address',
  'seller_city',
  'seller_state',
  'seller_zip',
  'seller_dl_number',
  'seller_dl_state',
  'seller_affirmed_ownership',
  'vehicle_year',
  'vehicle_make',
  'vehicle_model',
  'vehicle_color',
  'vehicle_plate',
  'transport_vin',
  'material',
  'weight_lb',
  'amount_paid',
  'payment_method',
  'is_catalytic_converter',
  'cat_converter_numbers',
  'hold_until',
];

export function buildNmrldExportCsv(
  rows: ComplianceReceiptRow[],
  registrationNumber = ''
): string {
  const lines: string[] = [NMRLD_HEADERS.join(',')];
  for (const r of rows) {
    const items = r.line_items?.length ? r.line_items : [null];
    for (const li of items) {
      lines.push(
        [
          registrationNumber,
          r.receipt_number,
          r.created_at,
          r.seller_name,
          r.seller_dob,
          r.seller_address,
          r.seller_city,
          r.seller_state,
          r.seller_zip,
          r.seller_dl_number,
          r.seller_state_of_issue,
          r.seller_affirmed ? 'yes' : 'no',
          r.vehicle_year,
          r.vehicle_make,
          r.vehicle_model,
          r.vehicle_color,
          r.vehicle_plate,
          r.transport_vin,
          li?.metal_name ?? '',
          li?.weight ?? '',
          li ? li.total : r.subtotal,
          r.payment_method,
          r.is_catalytic ? 'yes' : 'no',
          r.cat_converter_numbers,
          r.hold_until,
        ]
          .map(csvCell)
          .join(',')
      );
    }
  }
  return lines.join('\n');
}

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

export async function exportNmrldCsv(
  startDate: string,
  endDate: string
): Promise<string> {
  const [rows, registration] = await Promise.all([
    fetchComplianceReport(startDate, endDate),
    fetchNmrldRegistrationNumber(),
  ]);
  return buildNmrldExportCsv(rows, registration);
}

// ---------- Reporting queue (state / LeadsOnline upload) ----------
// Buy receipts not yet reported to the state database. This is the manual
// bridge today (export -> upload to LeadsOnline -> mark sent) and the exact
// delta the future automated SFTP job will transmit.
export async function fetchUnreportedReceipts(): Promise<
  ComplianceReceiptRow[]
> {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, line_items(metal_name, weight, total, is_restricted)')
    .eq('type', 'buy')
    .is('reported_at', null)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ComplianceReceiptRow[];
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
  const { data: pending, error } = await supabase
    .from('receipts')
    .select('created_at')
    .eq('type', 'buy')
    .is('reported_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = pending ?? [];
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
