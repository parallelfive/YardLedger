import * as Print from 'expo-print';
import { escapeHtml } from '../utils/validation';

// Desktop print documents. Print.printAsync works on web (opens the browser
// print dialog → the operator can print or Save-as-PDF). Kept separate from
// utils/printReceipt.ts because these are different documents (an audit
// purchase-record and a shipping bill of lading), not a customer buy ticket.

const money = (n: number) =>
  '$' +
  Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const shell = (title: string, body: string) => `
  <!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; color: #1b1813; padding: 32px; max-width: 720px; margin: 0 auto; }
    h1 { font-size: 22px; margin: 0 0 2px; letter-spacing: -0.3px; }
    .sub { color: #6a6258; font-size: 12px; margin-bottom: 20px; }
    .hd { border-bottom: 2px solid #1b1813; padding-bottom: 12px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #6a6258; border-bottom: 1px solid #d7d0c2; padding: 6px 4px; }
    td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 24px; margin-bottom: 18px; }
    .k { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #a39b8e; }
    .v { font-size: 14px; font-weight: 600; margin-top: 2px; }
    .total { display: flex; justify-content: space-between; border-top: 2px solid #1b1813; padding-top: 12px; margin-top: 8px; font-size: 18px; font-weight: 700; }
    .foot { color: #a39b8e; font-size: 11px; margin-top: 26px; }
  </style></head>
  <body><div class="hd"><h1>${escapeHtml(title)}</h1></div>${body}</body></html>`;

export interface ComplianceRecordDoc {
  no: string;
  seller: string;
  dl: string;
  plate: string;
  vehicle: string;
  materials: string;
  weight: number;
  paid: number;
  pay: string;
  affirmed: boolean;
}

export async function printComplianceRecord(
  r: ComplianceRecordDoc
): Promise<void> {
  const rows: [string, string][] = [
    ['Receipt', r.no],
    ['Seller', r.seller],
    ['Driver license', r.dl],
    ['Vehicle', r.vehicle],
    ['Plate', r.plate],
    ['Payment', r.pay],
    ['Ownership affirmed', r.affirmed ? 'Yes' : 'No'],
  ];
  const body = `
    <div class="sub">Purchase record · NM Sale of Recycled Metals Act</div>
    <div class="grid">
      ${rows.map(([k, v]) => `<div><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join('')}
    </div>
    <div class="k">Materials purchased</div>
    <div class="v" style="font-weight:500;line-height:1.5;margin:4px 0 18px">${escapeHtml(r.materials || '—')}</div>
    <div class="total"><span>Total paid · ${Number(r.weight).toLocaleString()} lb</span><span>${money(r.paid)}</span></div>
    <div class="foot">Generated ${new Date().toLocaleString()} · Tare</div>`;
  await Print.printAsync({ html: shell('Purchase Record', body) });
}

export interface DayCloseDoc {
  date: string;
  buysCount: number;
  cashOut: number;
  checkOut: number;
  buysTotal: number;
  weightBought: number;
  salesCount: number;
  salesRevenue: number;
  weightSold: number;
  profit: number;
  unreported: number;
  materials: { name: string; weight: number; value: number }[];
}

export async function printDayClose(d: DayCloseDoc): Promise<void> {
  const lbs = (n: number) => Number(n).toLocaleString() + ' lb';
  const kv: [string, string][] = [
    ['Buys', `${d.buysCount}`],
    ['Weight bought', lbs(d.weightBought)],
    ['Cash paid out', money(d.cashOut)],
    ['Check paid out', money(d.checkOut)],
    ['Sales', `${d.salesCount}`],
    ['Sales revenue', money(d.salesRevenue)],
    ['Weight sold', lbs(d.weightSold)],
    ['Est. gross profit', money(d.profit)],
    ['Unreported (restricted/catalytic)', `${d.unreported}`],
  ];
  const materials = d.materials.length
    ? `<table>
        <thead><tr><th>Material</th><th style="text-align:right">Weight</th><th style="text-align:right">Value</th></tr></thead>
        <tbody>${d.materials
          .map(
            (m) =>
              `<tr><td>${escapeHtml(m.name)}</td><td style="text-align:right">${lbs(m.weight)}</td><td style="text-align:right">${money(m.value)}</td></tr>`
          )
          .join('')}</tbody>
      </table>`
    : '';
  const body = `
    <div class="sub">End-of-day close · ${escapeHtml(d.date)}</div>
    <div class="grid">
      ${kv.map(([k, v]) => `<div><div class="k">${escapeHtml(k)}</div><div class="v">${escapeHtml(v)}</div></div>`).join('')}
    </div>
    ${materials ? '<div class="k">Materials bought today</div>' + materials : ''}
    <div class="total"><span>Cash paid out today</span><span>${money(d.cashOut)}</span></div>
    <div class="foot">Generated ${new Date().toLocaleString()} · Tare</div>`;
  await Print.printAsync({ html: shell('Day Close', body) });
}

export interface BillOfLadingDoc {
  no: string;
  buyer: string;
  metal: string;
  weight: number;
  pricePerLb: number;
  total: number;
  date: string;
}

export async function printBillOfLading(s: BillOfLadingDoc): Promise<void> {
  const body = `
    <div class="sub">Bill of lading · outbound load ${escapeHtml(s.no)}</div>
    <div class="grid">
      <div><div class="k">Processor / buyer</div><div class="v">${escapeHtml(s.buyer)}</div></div>
      <div><div class="k">Shipped</div><div class="v">${escapeHtml(s.date)}</div></div>
    </div>
    <table>
      <thead><tr><th>Material</th><th style="text-align:right">Weight</th><th style="text-align:right">Price/lb</th><th style="text-align:right">Total</th></tr></thead>
      <tbody><tr>
        <td>${escapeHtml(s.metal)}</td>
        <td style="text-align:right">${Number(s.weight).toLocaleString()} lb</td>
        <td style="text-align:right">${money(s.pricePerLb)}</td>
        <td style="text-align:right"><strong>${money(s.total)}</strong></td>
      </tr></tbody>
    </table>
    <div class="total"><span>Load total</span><span>${money(s.total)}</span></div>
    <div class="foot">Generated ${new Date().toLocaleString()} · Tare</div>`;
  await Print.printAsync({ html: shell('Bill of Lading', body) });
}
