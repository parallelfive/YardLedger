// Back-compat shim. The reporting determination now lives in the jurisdiction
// layer (src/compliance/jurisdictions) so it can vary by state; New Mexico is
// the default. These NM-bound exports are kept so existing callers/tests are
// unaffected — for multi-state, resolve a Jurisdiction via getJurisdiction()
// and call j.receiptIsReportable / j.lineIsReportable.
//
// Still mirrored in the report-to-state edge function (Deno can't import here).

export {
  REPORT_EXEMPT_MIN_LBS,
  lineIsReportable,
  receiptIsReportable,
} from '../compliance/jurisdictions/nm';
export type {
  ReportableLine,
  ReportableReceipt,
} from '../compliance/jurisdictions/types';
