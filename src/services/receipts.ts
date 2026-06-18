import { supabase } from '../config/supabase';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import type { LineItemInput } from '../types';
import { upsertCustomer } from './customers';
import { startOfLocalDayUtc, endOfLocalDayUtc } from '../utils/dateRange';

export interface CreateReceiptParams {
  customerName: string;
  customerPhone: string;
  customerId?: string;
  type: 'buy' | 'sell';
  subtotal: number;
  signatureUri?: string | null;
  workerId: string;
  notes?: string;
  vehiclePlate?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  sellerAffirmed?: boolean;
  sellerName?: string;
  sellerDlNumber?: string;
  sellerStateOfIssue?: string;
  sellerDob?: string;
  sellerAddress?: string;
  sellerCity?: string;
  sellerState?: string;
  sellerZip?: string;
  sellerIdPhotoUri?: string | null;
  catConverterNumbers?: string;
  transportVin?: string;
  catConverterPhotoUri?: string | null;
  catTitlePhotoUri?: string | null;
  sellerPhotoUri?: string | null;
  materialPhotoUri?: string | null;
  paymentMethod?: 'cash' | 'check' | 'other';
  isCatalytic?: boolean;
  lineItems: LineItemInput[];
}

// Company-scope the path so the private bucket's RLS isolates each yard. The
// `label` keeps parallel uploads from colliding on the same timestamped path.
async function uploadIdPhoto(
  localUri: string,
  companyId: string,
  label: string
): Promise<string> {
  const filePath = `${companyId}/${label}_${Date.now()}.jpg`;
  const file = new File(localUri);
  const base64 = await file.base64();
  const { error } = await supabase.storage
    .from('customer-ids')
    .upload(filePath, decode(base64), {
      contentType: 'image/jpeg',
      upsert: true,
    });
  if (error) throw error;
  // Store the object PATH, not a long-lived signed URL — callers sign on
  // demand (see services/storage.signPrivatePath / components/SignedImage).
  return filePath;
}

export async function createReceipt(params: CreateReceiptParams) {
  // Upload any local photo files — resolve the company once, then run the
  // independent uploads concurrently instead of serially.
  const photoInputs: { uri: string | null | undefined; label: string }[] = [
    { uri: params.sellerIdPhotoUri, label: 'sellerid' },
    { uri: params.catConverterPhotoUri, label: 'catconv' },
    { uri: params.catTitlePhotoUri, label: 'cattitle' },
    { uri: params.sellerPhotoUri, label: 'seller' },
    { uri: params.materialPhotoUri, label: 'material' },
  ];
  const needsUpload = photoInputs.some(
    (p) => p.uri && !p.uri.startsWith('http')
  );
  let companyId: string | null = null;
  if (needsUpload) {
    const { data, error } = await supabase.rpc('current_company_id');
    if (error || !data) {
      throw error ?? new Error('No current company for photo upload');
    }
    companyId = data as string;
  }
  const upload = (uri: string | null | undefined, label: string) =>
    uri && !uri.startsWith('http')
      ? uploadIdPhoto(uri, companyId as string, label)
      : Promise.resolve(uri ?? null);
  const [
    sellerIdPhotoUrl,
    catConverterPhotoUrl,
    catTitlePhotoUrl,
    sellerPhotoUrl,
    materialPhotoUrl,
  ] = await Promise.all(photoInputs.map((p) => upload(p.uri, p.label)));

  // Upsert customer record
  const customer = params.customerId
    ? { id: params.customerId }
    : await upsertCustomer(params.customerName, params.customerPhone);

  // Insert the receipt and its line items in a single transaction. If anything
  // fails (e.g. the pricing trigger rejects an override), the whole thing rolls
  // back — no orphan receipt is left on the compliance record. receipt_number,
  // company_id, created_by_session and hold_until are all set server-side.
  const receiptPayload = {
    customer_name: params.customerName,
    customer_phone: params.customerPhone,
    customer_id: customer.id,
    type: params.type,
    subtotal: params.subtotal,
    signature_uri: params.signatureUri ?? null,
    worker_id: params.workerId,
    notes: params.notes ?? null,
    vehicle_plate: params.vehiclePlate ?? '',
    vehicle_description: [
      params.vehicleYear,
      params.vehicleMake,
      params.vehicleModel,
    ]
      .filter(Boolean)
      .join(' '),
    vehicle_year: params.vehicleYear ?? '',
    vehicle_make: params.vehicleMake ?? '',
    vehicle_model: params.vehicleModel ?? '',
    vehicle_color: params.vehicleColor ?? '',
    seller_affirmed: params.sellerAffirmed ?? false,
    seller_name: params.sellerName ?? '',
    seller_dl_number: params.sellerDlNumber ?? '',
    seller_state_of_issue: params.sellerStateOfIssue ?? '',
    seller_dob: params.sellerDob ?? '',
    seller_address: params.sellerAddress ?? '',
    seller_city: params.sellerCity ?? '',
    seller_state: params.sellerState ?? '',
    seller_zip: params.sellerZip ?? '',
    seller_id_photo_uri: sellerIdPhotoUrl,
    cat_converter_numbers: params.catConverterNumbers ?? '',
    transport_vin: params.transportVin ?? '',
    cat_converter_photo_uri: catConverterPhotoUrl,
    cat_title_photo_uri: catTitlePhotoUrl,
    payment_method: params.paymentMethod ?? 'cash',
    is_catalytic: params.isCatalytic ?? false,
    seller_photo_uri: sellerPhotoUrl,
    material_photo_uri: materialPhotoUrl,
  };

  const lineItemsPayload = params.lineItems.map((item) => ({
    metal_id: item.metalId,
    metal_name: item.metalName,
    weight: item.weight,
    gross_weight: item.grossWeight ?? null,
    tare_weight: item.tareWeight ?? null,
    price_per_lb: item.pricePerLb,
    original_price_per_lb: item.originalPricePerLb,
    is_price_override: item.isPriceOverride,
    override_approved_by: item.overrideApprovedBy ?? null,
    total: item.total,
    is_regulated: item.isRegulated,
    is_restricted: item.isRestricted,
  }));

  const { data: receipt, error } = await supabase.rpc(
    'create_receipt_with_items',
    { p_receipt: receiptPayload, p_line_items: lineItemsPayload }
  );

  if (error) throw error;

  return receipt;
}

export async function deleteReceipt(receiptId: string) {
  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('id', receiptId);
  if (error) throw error;
}

// Mark a receipt's material as disposed/processed. The enforce_receipt_hold
// trigger rejects this if the mandatory hold window has not yet elapsed, so
// the hold is enforced server-side (NM 57-30-11 / 57-30-2.4).
export async function markReceiptDisposed(receiptId: string) {
  const { error } = await supabase
    .from('receipts')
    .update({ disposed_at: new Date().toISOString() })
    .eq('id', receiptId);
  if (error) throw error;
}

export async function fetchReceipts(
  workerId?: string,
  startDate?: string,
  endDate?: string
) {
  // Explicit projection for the list view — omits the heavy base64
  // signature_uri and photo columns (only the detail screen needs those).
  let query = supabase
    .from('receipts')
    .select(
      'id, receipt_number, customer_name, type, subtotal, created_at, worker_id, line_items(id, metal_name, weight, total, is_restricted)'
    )
    .order('created_at', { ascending: false });

  if (workerId) {
    query = query.eq('worker_id', workerId);
  }
  if (startDate) {
    query = query.gte('created_at', startOfLocalDayUtc(startDate));
  }
  if (endDate) {
    query = query.lte('created_at', endOfLocalDayUtc(endDate));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export interface ReceiptSearchRow {
  id: string;
  receipt_number: string;
  customer_name: string;
  subtotal: number;
  created_at: string;
}

/** Search receipts by receipt number or customer name (global header search). */
export async function searchReceipts(
  query: string
): Promise<ReceiptSearchRow[]> {
  // Strip characters that would broaden the ilike (% _ \) or break the PostgREST
  // .or() filter string (comma, parens) — keep it to a literal contains match.
  const safe = query.replace(/[\\%_,()]/g, ' ').trim();
  if (!safe) return [];
  const { data, error } = await supabase
    .from('receipts')
    .select('id, receipt_number, customer_name, subtotal, created_at')
    .or(`receipt_number.ilike.%${safe}%,customer_name.ilike.%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) throw error;
  return (data ?? []) as ReceiptSearchRow[];
}

export async function fetchReceiptById(receiptId: string) {
  const { data, error } = await supabase
    .from('receipts')
    .select('*, line_items(*, metals(name, price_per_lb))')
    .eq('id', receiptId)
    .single();
  if (error) throw error;
  return data;
}
