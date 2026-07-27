// Jurisdiction layer — a state's scrap-metal compliance rules as data + a small
// amount of logic, so adding a state is a new module here (not edits scattered
// across screens/services). `company_settings.state` selects the active one;
// New Mexico is the first entry (see nm.ts). Resolve via getJurisdiction().
//
// What lives PER JURISDICTION: the reportability determination (what must be
// filed with the state), the upload file format + registry, the statutory hold
// / retention defaults, and the legal copy shown in the UI. Per-COMPANY numeric
// overrides (hold hours, retention years, check-only, registration #) stay in
// company_settings and are read by the DB triggers.

// ── Line/receipt shapes used by the reportability rule ──────────────────────
type ExemptRef = { is_report_exempt?: boolean | null };

export interface ReportableLine {
  is_regulated?: boolean | null;
  is_restricted?: boolean | null;
  weight?: number | null;
  // is_report_exempt may sit directly on the line (snapshot) or come from the
  // joined metal. PostgREST returns a to-one embed as an object, but supabase-js
  // sometimes infers it as an array — accept any of these shapes.
  is_report_exempt?: boolean | null;
  metals?: ExemptRef | ExemptRef[] | null;
}

export interface ReportableReceipt {
  is_catalytic?: boolean | null;
  line_items?: ReportableLine[] | null;
}

// ── Line/receipt shapes used by the upload-file builder ─────────────────────
export interface ExportLineItem {
  metal_name: string;
  weight: number;
  total: number;
  unit?: string | null;
  quantity?: number | null;
}

export interface ExportRow {
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
  line_items: ExportLineItem[];
}

// ── The jurisdiction contract ────────────────────────────────────────────────
export interface JurisdictionCopy {
  stateName: string; // 'New Mexico'
  act: string; // 'NM Sale of Recycled Metals Act'
  registry: string; // 'LeadsOnline'
  reportBy: string; // '2nd business day'
  registrationLabel: string; // 'NMRLD registration #'
}

export interface Jurisdiction {
  code: string; // 2-letter state code, e.g. 'NM'
  copy: JurisdictionCopy;
  // Statutory defaults (a company may override the numbers in company_settings).
  holdDefaults: { generalHours: number; catConverterDays: number };
  catConverterCheckOnly: boolean;
  reportExemptMinLbs: number;
  // Reportability determination (what must reach the state registry).
  lineIsReportable(li: ReportableLine): boolean;
  receiptIsReportable(r: ReportableReceipt): boolean;
  // Upload-file format for this state's registry.
  exportHeaders: readonly string[];
  buildExportCsv(
    rows: ExportRow[],
    registrationNumber?: string,
    timezone?: string
  ): string;
}
