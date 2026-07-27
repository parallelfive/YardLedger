import { supabase } from '../config/supabase';
import { startOfLocalDayUtc, endOfLocalDayUtc } from '../utils/dateRange';
import { loadJson, saveJson } from './localStore';

export interface CreateSaleParams {
  metalId: string;
  metalName: string;
  weight: number;
  salePricePerLb: number;
  costBasisPerLb: number;
  buyerName?: string;
  workerId: string;
  // Per-piece sales (converters, rims): unit === 'each', quantity is the piece
  // count, and salePricePerLb / costBasisPerLb carry the per-piece figures.
  unit?: 'lb' | 'each';
  quantity?: number | null;
}

export async function createSale(params: CreateSaleParams) {
  const isPiece = params.unit === 'each';
  // The amount pricing runs off: piece count for 'each', weight otherwise. The
  // server (enforce_sale_integrity) recomputes revenue/profit authoritatively;
  // these are sent for offline/optimistic display and get overwritten on insert.
  const amount = isPiece ? (params.quantity ?? 0) : params.weight;
  const totalRevenue = amount * params.salePricePerLb;
  const profit = amount * (params.salePricePerLb - params.costBasisPerLb);

  const { data, error } = await supabase
    .from('sales')
    .insert({
      metal_id: params.metalId,
      metal_name: params.metalName,
      weight: isPiece ? 0 : params.weight,
      sale_price_per_lb: params.salePricePerLb,
      cost_basis_per_lb: params.costBasisPerLb,
      total_revenue: totalRevenue,
      profit,
      buyer_name: params.buyerName,
      worker_id: params.workerId,
      unit: params.unit ?? 'lb',
      quantity: isPiece ? (params.quantity ?? 0) : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchSales(startDate?: string, endDate?: string) {
  const run = async () => {
    let query = supabase
      .from('sales')
      .select('*, metals(category_id, metal_categories(name))')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startOfLocalDayUtc(startDate));
    }
    if (endDate) {
      query = query.lte('created_at', endOfLocalDayUtc(endDate));
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  };
  // Cache per range so the list still renders offline instead of erroring.
  // Offline-queued sales aren't in this list until they sync.
  const key = `sales_${startDate ?? ''}_${endDate ?? ''}`;
  try {
    const data = await run();
    await saveJson(key, data);
    return data;
  } catch (err) {
    const cached = await loadJson<Awaited<ReturnType<typeof run>>>(key);
    if (cached) return cached;
    throw err;
  }
}

export interface CategoryProfitSummary {
  categoryName: string;
  totalWeightSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

interface SaleWithCategory {
  weight: number;
  total_revenue: number;
  cost_basis_per_lb: number;
  profit: number;
  metals?: { metal_categories?: { name: string } | null } | null;
}

export function aggregateSalesByCategory(
  sales: SaleWithCategory[]
): CategoryProfitSummary[] {
  const map = new Map<string, CategoryProfitSummary>();

  for (const sale of sales) {
    const categoryName = sale.metals?.metal_categories?.name ?? 'Uncategorized';

    const existing = map.get(categoryName);
    const weight = Number(sale.weight);
    const revenue = Number(sale.total_revenue);
    const profit = Number(sale.profit);
    // Derive cost from revenue − profit so it's correct for weight AND per-piece
    // sales (a piece sale has weight 0, so weight × cost_basis would read $0).
    const cost = revenue - profit;

    if (existing) {
      existing.totalWeightSold += weight;
      existing.totalRevenue += revenue;
      existing.totalCost += cost;
      existing.totalProfit += profit;
    } else {
      map.set(categoryName, {
        categoryName,
        totalWeightSold: weight,
        totalRevenue: revenue,
        totalCost: cost,
        totalProfit: profit,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.categoryName.localeCompare(b.categoryName)
  );
}
