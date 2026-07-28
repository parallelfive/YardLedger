import { supabase } from '../config/supabase';

// A draft "scale ticket" — the worker's half of a buy (materials + weights),
// staged for the cashier to finalize (seller ID / photos / payment). Company
// scoping is enforced by RLS + the column default; queries don't filter on
// company_id explicitly.

// The line items a worker captured, carrying everything the cashier needs to
// finalize through createReceipt (so no data is re-entered at the front desk).
export interface DraftLineItem {
  metalId: string;
  metalName: string;
  weight: number; // net lb (0 for per-piece lines)
  grossWeight?: number | null;
  tareWeight?: number | null;
  pricePerLb: number; // $/lb, or $/piece for a per-piece line
  total: number;
  isRegulated: boolean;
  isRestricted: boolean;
  isCatalytic: boolean;
  // Per-piece pricing carried through the handoff. unit defaults to 'lb'.
  unit?: 'lb' | 'each';
  quantity?: number | null;
}

export interface DraftTicket {
  id: string;
  claim_number: string;
  worker_id: string | null;
  seller_name: string;
  line_items: DraftLineItem[];
  subtotal: number;
  weight: number;
  // Captured at the scale by the worker (next to the truck); pre-fills the
  // cashier's finalize step so the front desk never walks outside.
  vehicle_plate: string;
  vehicle_year: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  transport_vin: string;
  status: 'pending' | 'finalized' | 'voided';
  receipt_id: string | null;
  created_at: string;
}

export async function createDraftTicket(input: {
  workerId: string;
  sellerName?: string;
  lineItems: DraftLineItem[];
  subtotal: number;
  weight: number;
  vehiclePlate?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  transportVin?: string;
}): Promise<DraftTicket> {
  const { data, error } = await supabase
    .from('draft_tickets')
    .insert({
      worker_id: input.workerId || null,
      seller_name: input.sellerName?.trim() ?? '',
      line_items: input.lineItems,
      subtotal: input.subtotal,
      weight: input.weight,
      vehicle_plate: input.vehiclePlate?.trim() ?? '',
      vehicle_year: input.vehicleYear?.trim() ?? '',
      vehicle_make: input.vehicleMake?.trim() ?? '',
      vehicle_model: input.vehicleModel?.trim() ?? '',
      vehicle_color: input.vehicleColor?.trim() ?? '',
      transport_vin: input.transportVin?.trim() ?? '',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DraftTicket;
}

export async function fetchPendingDrafts(): Promise<DraftTicket[]> {
  const { data, error } = await supabase
    .from('draft_tickets')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DraftTicket[];
}

// Mark a draft finalized and link the receipt it became (audit trail). Called
// after the cashier's createReceipt succeeds.
export async function finalizeDraftTicket(
  id: string,
  receiptId: string
): Promise<void> {
  const { error } = await supabase
    .from('draft_tickets')
    .update({
      status: 'finalized',
      receipt_id: receiptId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

export async function voidDraftTicket(id: string): Promise<void> {
  const { error } = await supabase
    .from('draft_tickets')
    .update({ status: 'voided', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
