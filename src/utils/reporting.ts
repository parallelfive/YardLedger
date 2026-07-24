// NM LeadsOnline reporting determination (per RLD inspector, 2026-07-23).
//
// A buy must be reported if it contains regulated material other than the
// below-a-ton exemptions. The rule:
//   - Restricted materials (burnt, utility property, catalytic, etc.) → always.
//   - Regulated & NOT aluminum/steel (copper, brass, bronze, lead) → always.
//   - Aluminum (cans) / steel → only at >= 1 ton (2000 lb) on that line...
//   - ...BUT if the receipt has any other reportable line, the whole receipt is
//     reported and those exempt lines ride along.
// Capture (seller ID / vehicle / affidavit) is separate and fires for ALL
// regulated material — this governs only what goes to the state.
//
// IMPORTANT: keep in sync with the report-to-state edge function, which
// duplicates this logic in Deno.

export const REPORT_EXEMPT_MIN_LBS = 2000; // one ton

type ExemptRef = { is_report_exempt?: boolean | null };

export interface ReportableLine {
  is_regulated?: boolean | null;
  is_restricted?: boolean | null;
  weight?: number | null;
  // is_report_exempt may sit directly on the line (snapshot) or come from the
  // joined metal. PostgREST returns a to-one embed as an object at runtime, but
  // supabase-js sometimes infers it as an array — accept any of these shapes.
  is_report_exempt?: boolean | null;
  metals?: ExemptRef | ExemptRef[] | null;
}

const isExempt = (li: ReportableLine): boolean => {
  if (li.is_report_exempt != null) return !!li.is_report_exempt;
  const m = li.metals;
  const ref = Array.isArray(m) ? m[0] : m;
  return !!ref?.is_report_exempt;
};

export function lineIsReportable(li: ReportableLine): boolean {
  if (li.is_restricted) return true;
  if (!li.is_regulated) return false;
  // Regulated: report unless it's an exempt category (aluminum/steel) under a ton.
  if (isExempt(li)) return Number(li.weight ?? 0) >= REPORT_EXEMPT_MIN_LBS;
  return true;
}

export function receiptIsReportable(r: {
  is_catalytic?: boolean | null;
  line_items?: ReportableLine[] | null;
}): boolean {
  if (r.is_catalytic) return true;
  return (r.line_items ?? []).some(lineIsReportable);
}
