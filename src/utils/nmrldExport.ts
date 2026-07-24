// NMRLD (NM Regulation & Licensing Dept) recycled-metals database export — the
// CSV a dealer uploads to the state / LeadsOnline for each purchase (NM 57-30-8/9,
// due the 2nd business day). One row per metal line, carrying the seller /
// vehicle / material / payment data the upload requires.
//
// Pure formatting logic lives here (per the "formatting utilities go in utils/"
// rule) so it has no supabase/React-Native imports and can be unit-tested in a
// plain node environment.
//
// IMPORTANT: keep NMRLD_HEADERS and the row order below IN SYNC with the edge
// function supabase/functions/report-to-state/index.ts (HEADERS + buildCsv) so
// the manual export and the automated SFTP upload file the IDENTICAL record.

export interface NmrldLineItem {
  metal_name: string;
  weight: number;
  total: number;
}

// The fields the CSV builder reads. ComplianceReceiptRow (services/reports.ts)
// is a structural superset, so it's assignable here without a circular import.
export interface NmrldRow {
  receipt_number: string;
  created_at: string;
  seller_name: string | null;
  seller_dob: string | null;
  seller_address: string | null;
  seller_city: string | null;
  seller_state: string | null;
  seller_zip: string | null;
  seller_dl_number: string | null;
  seller_state_of_issue: string | null;
  seller_affirmed: boolean | null;
  seller_no_theft_affirmed: boolean | null;
  vehicle_year: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  vehicle_plate: string | null;
  transport_vin: string | null;
  cat_converter_numbers: string | null;
  is_catalytic: boolean | null;
  payment_method: string | null;
  hold_until: string | null;
  subtotal: number;
  line_items: NmrldLineItem[];
}

export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const NMRLD_HEADERS = [
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
  'seller_affirmed_no_theft',
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
  rows: NmrldRow[],
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
          r.seller_no_theft_affirmed ? 'yes' : 'no',
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
