import { supabase } from '../config/supabase';

interface CreateSaleParams {
  metalId: string;
  metalName: string;
  weight: number;
  salePricePerLb: number;
  costBasisPerLb: number;
  buyerName?: string;
  workerId: string;
}

export async function createSale(params: CreateSaleParams) {
  const totalRevenue = params.weight * params.salePricePerLb;
  const profit =
    params.weight * (params.salePricePerLb - params.costBasisPerLb);

  const { data, error } = await supabase
    .from('sales')
    .insert({
      metal_id: params.metalId,
      metal_name: params.metalName,
      weight: params.weight,
      sale_price_per_lb: params.salePricePerLb,
      cost_basis_per_lb: params.costBasisPerLb,
      total_revenue: totalRevenue,
      profit,
      buyer_name: params.buyerName,
      worker_id: params.workerId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchSales(startDate?: string, endDate?: string) {
  let query = supabase
    .from('sales')
    .select('*, metals(category_id, metal_categories(name))')
    .order('created_at', { ascending: false });

  if (startDate) {
    query = query.gte('created_at', `${startDate}T00:00:00`);
  }
  if (endDate) {
    query = query.lte('created_at', `${endDate}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export interface CategoryProfitSummary {
  categoryName: string;
  totalWeightSold: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

export function aggregateSalesByCategory(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sales: any[]
): CategoryProfitSummary[] {
  const map = new Map<string, CategoryProfitSummary>();

  for (const sale of sales) {
    const categoryName = sale.metals?.metal_categories?.name ?? 'Uncategorized';

    const existing = map.get(categoryName);
    const weight = Number(sale.weight);
    const revenue = Number(sale.total_revenue);
    const cost = weight * Number(sale.cost_basis_per_lb);
    const profit = Number(sale.profit);

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
