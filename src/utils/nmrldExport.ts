// Back-compat shim. The NMRLD upload format now lives in the New Mexico
// jurisdiction (src/compliance/jurisdictions/nm.ts) so each state can define its
// own registry file layout. These NM-bound exports are kept so existing callers
// and tests are unaffected — for multi-state, resolve a Jurisdiction via
// getJurisdiction() and call j.buildExportCsv / j.exportHeaders.
//
// Still mirrored in the report-to-state edge function (Deno can't import here).

export {
  NMRLD_HEADERS,
  csvCell,
  buildExportCsv as buildNmrldExportCsv,
} from '../compliance/jurisdictions/nm';
export type {
  ExportRow as NmrldRow,
  ExportLineItem as NmrldLineItem,
} from '../compliance/jurisdictions/types';
