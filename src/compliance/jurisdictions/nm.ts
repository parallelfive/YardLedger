// New Mexico — the first jurisdiction. Rules per the NM Sale of Recycled Metals
// Act (NM 57-30) and an RLD inspector's reporting determination (2026-07-23).
// Uploads go to LeadsOnline (the NMRLD recycled-metals database), due the 2nd
// business day.
//
// IMPORTANT: keep the reportability rule + NMRLD_HEADERS/row order IN SYNC with
// the report-to-state edge function (supabase/functions/report-to-state), which
// duplicates this logic in Deno and can't import from here.

import { localDateTimeInTz } from '../../utils/timezone';
import type {
  Jurisdiction,
  ReportableLine,
  ReportableReceipt,
  ExportRow,
} from './types';

const REPORT_EXEMPT_MIN_LBS = 2000; // one ton

const isExempt = (li: ReportableLine): boolean => {
  if (li.is_report_exempt != null) return !!li.is_report_exempt;
  const m = li.metals;
  const ref = Array.isArray(m) ? m[0] : m;
  return !!ref?.is_report_exempt;
};

// A buy must be reported if it contains regulated material other than the
// below-a-ton exemptions:
//   - Restricted (burnt, utility property, catalytic, etc.) → always.
//   - Regulated & NOT aluminum/steel (copper, brass, bronze, lead) → always.
//   - Aluminum (cans) / steel → only at >= 1 ton on that line...
//   - ...but if the receipt has any other reportable line, exempt lines ride along.
function lineIsReportable(li: ReportableLine): boolean {
  if (li.is_restricted) return true;
  if (!li.is_regulated) return false;
  if (isExempt(li)) return Number(li.weight ?? 0) >= REPORT_EXEMPT_MIN_LBS;
  return true;
}

function receiptIsReportable(r: ReportableReceipt): boolean {
  if (r.is_catalytic) return true;
  return (r.line_items ?? []).some(lineIsReportable);
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// NMRLD upload columns. One row per metal line; per-piece lines report a piece
// count in quantity_pieces and leave weight_lb blank (a converter isn't 0 lb).
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
  'seller_affirmed_no_theft',
  'vehicle_year',
  'vehicle_make',
  'vehicle_model',
  'vehicle_color',
  'vehicle_plate',
  'transport_vin',
  'material',
  'weight_lb',
  'quantity_pieces',
  'amount_paid',
  'payment_method',
  'is_catalytic_converter',
  'cat_converter_numbers',
  'hold_until',
] as const;

function buildExportCsv(
  rows: ExportRow[],
  registrationNumber = '',
  // Company IANA timezone; transaction_datetime is written in this zone so it
  // agrees with the receipt's local business date (an auditor would flag a raw
  // UTC timestamp reading as the next calendar day). Empty → raw created_at.
  timezone = ''
): string {
  const lines: string[] = [NMRLD_HEADERS.join(',')];
  for (const r of rows) {
    const items = r.line_items?.length ? r.line_items : [null];
    for (const li of items) {
      lines.push(
        [
          registrationNumber,
          r.receipt_number,
          timezone ? localDateTimeInTz(r.created_at, timezone) : r.created_at,
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
          li?.unit === 'each' ? '' : (li?.weight ?? ''),
          li?.unit === 'each' ? (li?.quantity ?? '') : '',
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

export const newMexico: Jurisdiction = {
  code: 'NM',
  copy: {
    stateName: 'New Mexico',
    act: 'NM Sale of Recycled Metals Act',
    registry: 'LeadsOnline',
    reportBy: '2nd business day',
    registrationLabel: 'NMRLD registration #',
  },
  holdDefaults: { generalHours: 24, catConverterDays: 60 },
  catConverterCheckOnly: true,
  reportExemptMinLbs: REPORT_EXEMPT_MIN_LBS,
  lineIsReportable,
  receiptIsReportable,
  exportHeaders: NMRLD_HEADERS,
  buildExportCsv,
};

// Re-exported so the util shims (and their existing tests) keep a stable API.
export {
  REPORT_EXEMPT_MIN_LBS,
  lineIsReportable,
  receiptIsReportable,
  csvCell,
  NMRLD_HEADERS,
  buildExportCsv,
};
