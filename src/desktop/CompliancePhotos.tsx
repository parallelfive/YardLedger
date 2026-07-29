import { useEffect, useState } from 'react';
import { signPrivatePath } from '../services/storage';

// Shared evidence-photo panel for the desktop record detail views (the
// Compliance record slide-over AND the day-book / seller-history ticket detail),
// so both render the SAME stored photos instead of one showing them and the
// other showing nothing (#107). Photos live in a private bucket as object PATHS;
// we mint a short-lived signed URL per photo at render time.

export interface CompliancePhoto {
  label: string;
  path: string;
}

// The receipt photo columns we surface, in display order (label → column).
const PHOTO_FIELDS: [string, string][] = [
  ['ID scan', 'seller_id_photo_uri'],
  ['Driver license', 'dl_photo_uri'],
  ['Seller', 'seller_photo_uri'],
  ['Material', 'material_photo_uri'],
  ['Converter', 'cat_converter_photo_uri'],
  ['Title', 'cat_title_photo_uri'],
  ['Signature', 'signature_uri'],
];

// Build the {label, path} list from any receipt-shaped record — the typed
// ComplianceReceiptRow or a loosely-typed fetched receipt. Absent/non-string
// columns are skipped, so only captured photos get a tile.
export function buildCompliancePhotos(
  r: Record<string, unknown>
): CompliancePhoto[] {
  return PHOTO_FIELDS.map(([label, key]) => ({
    label,
    path: typeof r[key] === 'string' ? (r[key] as string) : '',
  })).filter((p) => p.path);
}

export function CompliancePhotos({ photos }: { photos: CompliancePhoto[] }) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  useEffect(() => {
    let active = true;
    Promise.all(
      photos.map(async (p) => [p.label, await signPrivatePath(p.path)] as const)
    ).then((pairs) => {
      if (active) setUrls(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [photos]);

  if (photos.length === 0) {
    return (
      <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        No photos captured for this record.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {photos.map((p) => {
        const url = urls[p.label];
        return (
          <div key={p.label} style={{ width: 104 }}>
            <div
              style={{
                height: 88,
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--surface-2)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {url === undefined ? (
                <span
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-3)' }}
                >
                  …
                </span>
              ) : url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: 'block', width: '100%', height: '100%' }}
                >
                  <img
                    src={url}
                    alt={p.label}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </a>
              ) : (
                <span
                  className="mono"
                  style={{ fontSize: 10, color: 'var(--ink-3)' }}
                >
                  unavailable
                </span>
              )}
            </div>
            <div
              className="mono"
              style={{
                fontSize: 9.5,
                color: 'var(--ink-3)',
                marginTop: 5,
                textAlign: 'center',
              }}
            >
              {p.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
