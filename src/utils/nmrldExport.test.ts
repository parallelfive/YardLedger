import { describe, it, expect } from 'vitest';
import {
  buildNmrldExportCsv,
  NMRLD_HEADERS,
  csvCell,
  type NmrldRow,
} from './nmrldExport';

// A fully-populated reportable buy (regulated + catalytic).
const baseRow: NmrldRow = {
  receipt_number: 'GR-2026-07212026-3',
  created_at: '2026-07-21T18:35:20.000Z',
  seller_name: 'Carlos Ray Martinez',
  seller_dob: '03/15/1985',
  seller_address: '742 Evergreen Ter',
  seller_city: 'Albuquerque',
  seller_state: 'NM',
  seller_zip: '87110',
  seller_dl_number: 'D12345678',
  seller_state_of_issue: 'NM',
  seller_affirmed: true,
  seller_no_theft_affirmed: true,
  vehicle_year: null,
  vehicle_make: null,
  vehicle_model: null,
  vehicle_color: null,
  vehicle_plate: 'NM ABC123',
  transport_vin: '1HGCM82633A004352',
  cat_converter_numbers: null,
  is_catalytic: true,
  payment_method: 'check',
  hold_until: '2026-07-22T18:35:20.000Z',
  subtotal: 240,
  line_items: [{ metal_name: 'Catalytic Converter', weight: 40, total: 240 }],
};

const headerCols = NMRLD_HEADERS.length;

describe('buildNmrldExportCsv', () => {
  it('emits the header first, with the no-theft attestation column present and positioned', () => {
    const csv = buildNmrldExportCsv([baseRow], 'NMRLD-999');
    const [header] = csv.split('\n');
    expect(header).toBe(NMRLD_HEADERS.join(','));
    // The attestation we added must sit right after the ownership affirmation.
    const cols = header.split(',');
    expect(cols).toContain('seller_affirmed_no_theft');
    expect(cols.indexOf('seller_affirmed_no_theft')).toBe(
      cols.indexOf('seller_affirmed_ownership') + 1
    );
  });

  it('maps booleans to yes/no and stamps the registration number', () => {
    const row = buildNmrldExportCsv([baseRow], 'NMRLD-999').split('\n')[1];
    const cells = row.split(',');
    expect(cells[0]).toBe('NMRLD-999');
    expect(cells[NMRLD_HEADERS.indexOf('seller_affirmed_ownership')]).toBe(
      'yes'
    );
    expect(cells[NMRLD_HEADERS.indexOf('seller_affirmed_no_theft')]).toBe(
      'yes'
    );
    expect(cells[NMRLD_HEADERS.indexOf('is_catalytic_converter')]).toBe('yes');
    // A plain row (no embedded commas) has exactly one cell per header column.
    expect(cells.length).toBe(headerCols);
  });

  it('emits one row per line item', () => {
    const multi: NmrldRow = {
      ...baseRow,
      line_items: [
        { metal_name: 'Copper', weight: 10, total: 30 },
        { metal_name: 'Brass', weight: 20, total: 40 },
      ],
    };
    const lines = buildNmrldExportCsv([multi]).split('\n');
    expect(lines).toHaveLength(3); // header + 2 items
    expect(lines[1]).toContain('Copper');
    expect(lines[2]).toContain('Brass');
  });

  it('falls back to the receipt subtotal when there are no line items', () => {
    const noItems: NmrldRow = { ...baseRow, line_items: [] };
    const lines = buildNmrldExportCsv([noItems]).split('\n');
    expect(lines).toHaveLength(2); // header + 1 synthetic row
    const cells = lines[1].split(',');
    expect(cells[NMRLD_HEADERS.indexOf('amount_paid')]).toBe('240');
    expect(cells[NMRLD_HEADERS.indexOf('material')]).toBe('');
  });

  it('maps false/null flags to no and empty cells', () => {
    const bare: NmrldRow = {
      ...baseRow,
      seller_affirmed: false,
      seller_no_theft_affirmed: null,
      is_catalytic: null,
      seller_dob: null,
    };
    const cells = buildNmrldExportCsv([bare]).split('\n')[1].split(',');
    expect(cells[NMRLD_HEADERS.indexOf('seller_affirmed_ownership')]).toBe(
      'no'
    );
    expect(cells[NMRLD_HEADERS.indexOf('seller_affirmed_no_theft')]).toBe('no');
    expect(cells[NMRLD_HEADERS.indexOf('is_catalytic_converter')]).toBe('no');
    expect(cells[NMRLD_HEADERS.indexOf('seller_dob')]).toBe('');
  });
});

describe('csvCell', () => {
  it('quotes and escapes cells containing commas, quotes, or newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(240)).toBe('240');
  });
});
