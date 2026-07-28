import { printHtml } from './printHtml';
import { escapeHtml } from './validation';
import type { ClientStatement } from './clientStatement';

// Print / Save-as-PDF a client's yearly purchase statement — the seller's own
// record of what they sold to the yard. Uses expo-print, which works on web
// (browser print dialog) and native. NOT a tax document (say so on the page).

export interface StatementCustomer {
  name: string;
  phone?: string | null;
  address?: string | null;
}

const money = (n: number) =>
  '$' +
  Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const lbs = (n: number) =>
  Number(n).toLocaleString('en-US', { maximumFractionDigits: n % 1 ? 1 : 0 });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export async function printClientStatement(
  s: ClientStatement,
  customer: StatementCustomer,
  yardName: string
): Promise<void> {
  const amountCol = (m: { weightLb: number; pieces: number }) =>
    [
      m.weightLb > 0 ? `${lbs(m.weightLb)} lb` : '',
      m.pieces > 0 ? `${m.pieces} pcs` : '',
    ]
      .filter(Boolean)
      .join(' · ') || '—';

  const materials = s.byMaterial
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.name)}</td><td style="text-align:right">${amountCol(m)}</td><td style="text-align:right">${money(m.amount)}</td></tr>`
    )
    .join('');

  const rows = s.lines
    .map(
      (l) =>
        `<tr><td>${fmtDate(l.date)}</td><td class="mono">${escapeHtml(l.receiptNumber)}</td><td>${escapeHtml(l.materials || '—')}</td><td style="text-align:right">${money(l.amount)}</td></tr>`
    )
    .join('');

  const html = `
    <!DOCTYPE html><html><head><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, system-ui, sans-serif; color: #1b1813; padding: 32px; max-width: 760px; margin: 0 auto; }
      h1 { font-size: 22px; margin: 0 0 2px; letter-spacing: -0.3px; }
      .sub { color: #6a6258; font-size: 12px; margin-bottom: 18px; }
      .hd { border-bottom: 2px solid #1b1813; padding-bottom: 12px; margin-bottom: 16px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 18px; }
      .k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #a39b8e; }
      .v { font-size: 14px; font-weight: 600; margin-top: 2px; }
      .mono { font-family: ui-monospace, Menlo, monospace; }
      .cards { display: flex; gap: 12px; margin: 4px 0 20px; }
      .card { flex: 1; border: 1px solid #d7d0c2; border-radius: 8px; padding: 12px 14px; }
      .card .n { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0 20px; }
      th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6a6258; border-bottom: 1px solid #d7d0c2; padding: 6px 4px; }
      td { padding: 7px 4px; border-bottom: 1px solid #eee; font-size: 12.5px; }
      .sec { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: #6a6258; font-weight: 700; margin: 6px 0; }
      .total { display: flex; justify-content: space-between; border-top: 2px solid #1b1813; padding-top: 12px; font-size: 18px; font-weight: 700; }
      .foot { color: #a39b8e; font-size: 10.5px; margin-top: 22px; line-height: 1.5; }
    </style></head>
    <body>
      <div class="hd"><h1>${escapeHtml(yardName || 'Purchase statement')}</h1>
        <div class="sub">Purchase statement · ${escapeHtml(s.periodLabel)}</div></div>
      <div class="grid">
        <div><div class="k">Seller</div><div class="v">${escapeHtml(customer.name || '—')}</div></div>
        <div><div class="k">Phone</div><div class="v">${escapeHtml(customer.phone || '—')}</div></div>
        <div style="grid-column:1/3"><div class="k">Address</div><div class="v">${escapeHtml(customer.address || '—')}</div></div>
      </div>
      <div class="cards">
        <div class="card"><div class="k">Transactions</div><div class="n">${s.transactionCount}</div></div>
        <div class="card"><div class="k">Total weight</div><div class="n">${lbs(s.totalWeightLb)}${s.totalPieces > 0 ? ` <span style="font-size:12px">+ ${s.totalPieces} pcs</span>` : ''}</div></div>
        <div class="card"><div class="k">Total paid</div><div class="n">${money(s.totalPaid)}</div></div>
      </div>
      <div class="sec">By material</div>
      <table>
        <thead><tr><th>Material</th><th style="text-align:right">Amount</th><th style="text-align:right">Paid</th></tr></thead>
        <tbody>${materials || '<tr><td colspan="3">No purchases this year.</td></tr>'}</tbody>
      </table>
      <div class="sec">Transactions</div>
      <table>
        <thead><tr><th>Date</th><th>Receipt</th><th>Materials</th><th style="text-align:right">Paid</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="total"><span>Total paid · ${escapeHtml(s.periodLabel)}</span><span>${money(s.totalPaid)}</span></div>
      <div class="foot">Summary of purchases from the seller named above for ${escapeHtml(s.periodLabel)}. Provided for the seller's records — <b>not a tax document</b> and not an official receipt. Generated ${new Date().toLocaleString()} · Tare.</div>
    </body></html>`;

  await printHtml(html);
}
