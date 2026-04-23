import { supabase } from '../config/supabase';

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

export async function fetchDailySummary(
  startDate: string,
  endDate: string
): Promise<DailySummary> {
  const rangeStart = `${startDate}T00:00:00`;
  const rangeEnd = `${endDate}T23:59:59`;

  // Fetch buy receipts with line items in range
  const { data: receipts } = await supabase
    .from('receipts')
    .select('id, subtotal, line_items(metal_name, weight, price_per_lb)')
    .eq('type', 'buy')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);

  // Fetch sales in range
  const { data: sales } = await supabase
    .from('sales')
    .select('weight, total_revenue, profit')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);

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
  const rangeStart = `${startDate}T00:00:00`;
  const rangeEnd = `${endDate}T23:59:59`;

  // Fetch buy line items in range
  const { data: buyData } = await supabase
    .from('line_items')
    .select(
      'metal_id, metal_name, weight, price_per_lb, receipts!inner(type), metals(metal_categories(name))'
    )
    .eq('receipts.type', 'buy')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);

  // Fetch sales in range
  const { data: salesData } = await supabase
    .from('sales')
    .select(
      'metal_id, metal_name, weight, cost_basis_per_lb, total_revenue, profit, metals(metal_categories(name))'
    )
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd);

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
  const { data: buyData } = await supabase
    .from('line_items')
    .select(
      'metal_id, metal_name, weight, receipts!inner(type), metals(metal_categories(name))'
    )
    .eq('receipts.type', 'buy');

  // All sales aggregated by metal
  const { data: salesData } = await supabase
    .from('sales')
    .select('metal_id, weight');

  // Current inventory
  const { data: invData } = await supabase
    .from('inventory')
    .select('metal_id, weight');

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
    .gte('created_at', `${startDate}T00:00:00`)
    .lte('created_at', `${endDate}T23:59:59`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as ComplianceReceiptRow[];
}
