// Receipt evidence-photo columns surfaced in the desktop record-detail views,
// in display order (label -> receipt column). Pure + framework-free so the
// photo panel (desktop/CompliancePhotos) and its regression tests share one
// source of truth — the audit view must show ONLY actually-captured evidence,
// never a placeholder standing in for a photo that isn't there (#107).

export interface CompliancePhoto {
  label: string;
  path: string;
}

export const PHOTO_FIELDS: [string, string][] = [
  ['ID scan', 'seller_id_photo_uri'],
  ['Driver license', 'dl_photo_uri'],
  ['Seller', 'seller_photo_uri'],
  ['Material', 'material_photo_uri'],
  ['Converter', 'cat_converter_photo_uri'],
  ['Title', 'cat_title_photo_uri'],
  ['Signature', 'signature_uri'],
];

// Build the {label, path} list from any receipt-shaped record — the typed
// ComplianceReceiptRow or a loosely-typed fetched receipt. Absent or non-string
// columns are dropped, so only captured photos produce a tile.
export function buildCompliancePhotos(
  r: Record<string, unknown>
): CompliancePhoto[] {
  return PHOTO_FIELDS.map(([label, key]) => ({
    label,
    path: typeof r[key] === 'string' ? (r[key] as string) : '',
  })).filter((p) => p.path);
}
