import type { LineItemInput } from '../types';

// Round to cents so the client subtotal equals sum(round(line)) and matches
// the server-side numeric(12,2) total recomputed by the line_items trigger.
export function calculateLineItemTotal(
  weight: number,
  pricePerLb: number
): number {
  return Math.round(weight * pricePerLb * 100) / 100;
}

export function calculateReceiptTotal(lineItems: LineItemInput[]): number {
  return lineItems.reduce((sum, item) => sum + item.total, 0);
}

export function calculateCurrentPreview(
  weight: string,
  pricePerLb: number
): number {
  return Math.round((parseFloat(weight) || 0) * pricePerLb * 100) / 100;
}

export function calculateInventoryValue(
  weight: number,
  avgCostPerLb: number
): number {
  return weight * avgCostPerLb;
}

export function calculateTotalProfit(
  sales: { profit: number | string }[]
): number {
  return sales.reduce((sum, sale) => sum + Number(sale.profit), 0);
}
