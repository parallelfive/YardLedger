import { describe, it, expect } from 'vitest';
import { buildCompliancePhotos, PHOTO_FIELDS } from './receiptPhotos';

describe('buildCompliancePhotos (#107)', () => {
  it('returns only the columns that hold a captured photo path', () => {
    const photos = buildCompliancePhotos({
      seller_id_photo_uri: 'ids/a.jpg',
      material_photo_uri: 'materials/b.jpg',
      // dl/seller/converter/title/signature absent -> no tile
    });
    expect(photos).toEqual([
      { label: 'ID scan', path: 'ids/a.jpg' },
      { label: 'Material', path: 'materials/b.jpg' },
    ]);
  });

  it('never fabricates a tile for a missing, empty, or non-string column', () => {
    const photos = buildCompliancePhotos({
      seller_id_photo_uri: '', // empty string is "not captured"
      dl_photo_uri: null,
      seller_photo_uri: undefined,
      material_photo_uri: 42, // non-string junk
    });
    expect(photos).toEqual([]);
  });

  it('preserves the declared display order', () => {
    const all = Object.fromEntries(
      PHOTO_FIELDS.map(([, key]) => [key, `${key}.jpg`])
    );
    const labels = buildCompliancePhotos(all).map((p) => p.label);
    expect(labels).toEqual(PHOTO_FIELDS.map(([label]) => label));
  });

  it('returns nothing for a record with no photo columns', () => {
    expect(buildCompliancePhotos({ id: 'r1', total: 100 })).toEqual([]);
  });
});
