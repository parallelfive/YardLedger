import { describe, it, expect } from 'vitest';
import {
  buildClientStatement,
  statementYears,
  type StatementReceipt,
} from './clientStatement';

const receipts: StatementReceipt[] = [
  {
    created_at: '2026-03-10T12:00:00Z',
    receipt_number: 'GR-2026-1',
    subtotal: 300,
    type: 'buy',
    line_items: [
      { metal_name: '#1 Copper', weight: 100, total: 300, unit: 'lb' },
    ],
  },
  {
    created_at: '2026-01-05T12:00:00Z',
    receipt_number: 'GR-2026-0',
    subtotal: 480,
    type: 'buy',
    line_items: [
      {
        metal_name: 'Catalytic Converter',
        quantity: 4,
        total: 480,
        unit: 'each',
      },
    ],
  },
  {
    // Different year — must be excluded from 2026.
    created_at: '2025-12-31T12:00:00Z',
    receipt_number: 'GR-2025-9',
    subtotal: 50,
    type: 'buy',
    line_items: [
      { metal_name: '#2 Copper', weight: 20, total: 50, unit: 'lb' },
    ],
  },
];

describe('buildClientStatement', () => {
  it('aggregates a customer’s buys for the chosen year only', () => {
    const s = buildClientStatement(receipts, 2026);
    expect(s.transactionCount).toBe(2);
    expect(s.totalPaid).toBe(780); // 300 + 480
    expect(s.totalWeightLb).toBe(100); // per-piece line carries no weight
    expect(s.totalPieces).toBe(4);
  });

  it('breaks down by material, sorted by amount desc', () => {
    const s = buildClientStatement(receipts, 2026);
    expect(s.byMaterial.map((m) => m.name)).toEqual([
      'Catalytic Converter',
      '#1 Copper',
    ]);
    expect(s.byMaterial[0]).toMatchObject({
      pieces: 4,
      amount: 480,
      weightLb: 0,
    });
  });

  it('lists lines chronologically (oldest first)', () => {
    const s = buildClientStatement(receipts, 2026);
    expect(s.lines.map((l) => l.receiptNumber)).toEqual([
      'GR-2026-0',
      'GR-2026-1',
    ]);
    expect(s.lines[0].materials).toBe('Catalytic Converter (4 pcs)');
  });

  it('lists the distinct buy years, newest first', () => {
    expect(statementYears(receipts)).toEqual([2026, 2025]);
  });

  it('filters to selected quarters, multi-select supported', () => {
    // Both 2026 buys fall in Q1 (Jan 5 + Mar 10).
    expect(buildClientStatement(receipts, 2026).periodLabel).toBe('2026'); // full year
    const q1 = buildClientStatement(receipts, 2026, [1]);
    expect(q1.transactionCount).toBe(2);
    expect(q1.periodLabel).toBe('2026 · Q1');
    expect(buildClientStatement(receipts, 2026, [2]).transactionCount).toBe(0);
    // Multi-select (order-independent, de-duped, sorted in the label).
    const h1 = buildClientStatement(receipts, 2026, [2, 1, 1]);
    expect(h1.transactionCount).toBe(2);
    expect(h1.periodLabel).toBe('2026 · Q1, Q2');
  });
});
