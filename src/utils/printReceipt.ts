import { Platform } from 'react-native';
import * as Print from 'expo-print';
import { printHtml } from './printHtml';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import {
  fetchCompanySettings,
  type CompanySettings,
} from '../services/companySettings';
import { escapeHtml } from './validation';

interface PrintLineItem {
  metal_name: string;
  weight: number;
  price_per_lb: number;
  total: number;
  is_price_override: boolean;
  original_price_per_lb?: number;
  // Per-piece lines (converters, rims) print as quantity/each, not weight/lb.
  unit?: string | null;
  quantity?: number | null;
}

interface PrintReceiptData {
  receipt_number: string;
  customer_name: string;
  customer_phone?: string;
  vehicle_plate?: string;
  vehicle_description?: string;
  seller_affirmed?: boolean;
  subtotal: number;
  signature_uri?: string | null;
  created_at: string;
  line_items: PrintLineItem[];
}

function buildReceiptHtml(
  receipt: PrintReceiptData,
  company: CompanySettings | null
): string {
  const lineItemsHtml = receipt.line_items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.metal_name)}</td>
        <td style="text-align:right">${
          item.unit === 'each'
            ? `${Number(item.quantity ?? 0)} pc${Number(item.quantity) === 1 ? '' : 's'}`
            : `${Number(item.weight).toFixed(2)} lbs`
        }</td>
        <td style="text-align:right">$${Number(item.price_per_lb).toFixed(item.unit === 'each' ? 2 : 4)}/${item.unit === 'each' ? 'pc' : 'lb'}${
          item.is_price_override
            ? `<br><small style="color:#999;text-decoration:line-through">$${Number(item.original_price_per_lb ?? item.price_per_lb).toFixed(item.unit === 'each' ? 2 : 4)}/${item.unit === 'each' ? 'pc' : 'lb'}</small>`
            : ''
        }</td>
        <td style="text-align:right"><strong>$${Number(item.total).toFixed(2)}</strong></td>
      </tr>`
    )
    .join('');

  const date = new Date(receipt.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Company header
  const companyName = escapeHtml(company?.company_name || 'YardLedger');
  const logoHtml = company?.logo_url
    ? `<img class="logo" src="${company.logo_url}" alt="" />`
    : '';
  const addressHtml = company?.address
    ? `<div class="muted">${escapeHtml(company.address).replace(/\n/g, '<br>')}</div>`
    : '';
  const companyPhoneHtml = company?.phone
    ? `<div class="muted">${escapeHtml(company.phone)}</div>`
    : '';

  const signatureHtml = receipt.signature_uri
    ? `<div class="sig">
        <p>Seller signature</p>
        <img src="${receipt.signature_uri}" alt="" />
      </div>`
    : '';

  // A meta row only renders when there's a value — keeps the receipt tidy.
  const metaRow = (k: string, v: string) =>
    v
      ? `<div class="row"><span class="k">${k}</span><span class="v">${v}</span></div>`
      : '';

  const vehicle = [receipt.vehicle_plate, receipt.vehicle_description]
    .filter(Boolean)
    .map((s) => escapeHtml(String(s)))
    .join(' · ');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        * { box-sizing: border-box; }
        html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @page { margin: 8mm; }
        body {
          font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          color: #1a1712; margin: 0 auto; padding: 26px 22px;
          max-width: 92mm; font-size: 13px; line-height: 1.45;
        }
        .brand { text-align: center; margin-bottom: 18px; }
        .brand .logo { max-width: 132px; max-height: 76px; object-fit: contain; margin-bottom: 10px; }
        .brand h1 { font-size: 20px; letter-spacing: 0.4px; margin: 0 0 3px; font-weight: 800; }
        .muted { font-size: 11px; color: #7a7269; line-height: 1.45; }
        .doctype {
          text-align: center; font-size: 10px; letter-spacing: 2.6px;
          text-transform: uppercase; color: #8a8178; font-weight: 700;
          border-top: 1px solid #e3ddd2; border-bottom: 1px solid #e3ddd2;
          padding: 7px 0; margin: 0 0 16px;
        }
        .meta { margin-bottom: 8px; }
        .row { display: flex; justify-content: space-between; gap: 12px; padding: 3px 0; font-size: 12.5px; }
        .row .k { color: #8a8178; white-space: nowrap; }
        .row .v { font-weight: 600; text-align: right; font-variant-numeric: tabular-nums; }
        table { width: 100%; border-collapse: collapse; margin: 14px 0 4px; }
        thead th {
          font-size: 9.5px; letter-spacing: 0.8px; text-transform: uppercase;
          color: #8a8178; border-bottom: 1.5px solid #1a1712; padding: 6px 3px; text-align: right;
        }
        thead th:first-child { text-align: left; }
        tbody td { padding: 8px 3px; border-bottom: 1px solid #eee6d9; font-size: 12.5px; font-variant-numeric: tabular-nums; vertical-align: top; }
        .payout {
          margin-top: 16px; border: 2px solid #1a1712; border-radius: 11px;
          padding: 13px 16px; display: flex; align-items: center; justify-content: space-between;
          gap: 12px; background: #f6f1e8;
        }
        .payout .lbl { font-size: 10.5px; letter-spacing: 1.6px; text-transform: uppercase; font-weight: 700; color: #5a544b; }
        .payout .amt { font-size: 29px; font-weight: 800; letter-spacing: -0.5px; font-variant-numeric: tabular-nums; }
        .sig { margin-top: 22px; border-top: 1px solid #e3ddd2; padding-top: 12px; }
        .sig p { margin: 0 0 7px; font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: #8a8178; }
        .sig img { max-width: 260px; height: 84px; object-fit: contain; }
        .foot { margin-top: 22px; text-align: center; font-size: 10px; color: #9a9188; line-height: 1.7; }
        .foot .thanks { font-size: 12.5px; color: #3a352e; font-weight: 700; margin-bottom: 3px; letter-spacing: 0.3px; }
      </style>
    </head>
    <body>
      <div class="brand">
        ${logoHtml}
        <h1>${companyName}</h1>
        ${addressHtml}
        ${companyPhoneHtml}
      </div>

      <div class="doctype">Purchase Receipt</div>

      <div class="meta">
        ${metaRow('Receipt&nbsp;#', escapeHtml(receipt.receipt_number))}
        ${metaRow('Date', date)}
        ${metaRow('Paid to', escapeHtml(receipt.customer_name))}
        ${metaRow('Phone', escapeHtml(receipt.customer_phone ?? ''))}
        ${metaRow('Vehicle', vehicle)}
        ${receipt.seller_affirmed ? metaRow('Ownership affirmed', 'Yes') : ''}
      </div>

      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Qty / Wt</th>
            <th>Unit price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <div class="payout">
        <span class="lbl">Total Paid</span>
        <span class="amt">$${Number(receipt.subtotal).toFixed(2)}</span>
      </div>

      ${signatureHtml}

      <div class="foot">
        <div class="thanks">Thank you</div>
        Please retain this receipt for your records.<br />
        ${companyName}
      </div>
    </body>
    </html>
  `;
}

export async function printReceipt(receipt: PrintReceiptData): Promise<void> {
  let company: CompanySettings | null = null;
  try {
    company = await fetchCompanySettings();
  } catch {
    // Will use defaults
  }
  const html = buildReceiptHtml(receipt, company);
  await printHtml(html);
}

export async function shareReceipt(receipt: PrintReceiptData): Promise<void> {
  let company: CompanySettings | null = null;
  try {
    company = await fetchCompanySettings();
  } catch {
    // Will use defaults
  }
  const html = buildReceiptHtml(receipt, company);

  // Web has no PDF-to-file + OS share sheet. Fall back to the browser print
  // dialog, from which the operator can "Save as PDF" or print — the closest
  // equivalent action.
  if (Platform.OS === 'web') {
    await printHtml(html);
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });

  // Copy to a named file so the share sheet shows a nice filename
  const fileName = `${receipt.receipt_number || 'receipt'}.pdf`;
  const dest = new File(Paths.cache, fileName);
  const source = new File(uri);
  source.move(dest);

  try {
    await Sharing.shareAsync(dest.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: receipt.receipt_number,
    });
  } finally {
    // Receipt PDF carries seller PII — don't leave it in the cache dir.
    try {
      dest.delete();
    } catch {
      /* best effort */
    }
  }
}

export { type PrintReceiptData };
