import { useEffect, useState } from 'react';
import { signPrivatePath } from '../services/storage';
import {
  type CompliancePhoto,
  buildCompliancePhotos,
} from '../utils/receiptPhotos';

// Shared evidence-photo panel for the desktop record detail views (the
// Compliance record slide-over AND the day-book / seller-history ticket detail),
// so both render the SAME stored photos instead of one showing them and the
// other showing nothing (#107). Photos live in a private bucket as object PATHS;
// we mint a short-lived signed URL per photo at render time. The {label, path}
// derivation lives in utils/receiptPhotos (pure + unit-tested); re-exported here
// so existing `from '../CompliancePhotos'` imports are unchanged.
export { buildCompliancePhotos };
export type { CompliancePhoto };

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
