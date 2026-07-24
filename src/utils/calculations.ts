import type { LineItemInput } from '../types';

// Effective net weight for a buy line. In tare/vehicle mode the payable weight
// is gross minus tare, clamped at 0 so a half-entered ticket (tare typed before
// gross) never pays out a negative weight; otherwise it's the directly-weighed
// net. This is what the operator is paid on, so it must match the buy flow.
export function calculateNetWeight(
  mode: 'net' | 'tare',
  values: { net?: number; gross?: number; tare?: number }
): number {
  if (mode === 'tare') {
    return Math.max(0, (values.gross || 0) - (values.tare || 0));
  }
  return values.net || 0;
}

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
