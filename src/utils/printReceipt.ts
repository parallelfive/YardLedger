import * as Print from 'expo-print';
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
        <td style="text-align:right">${Number(item.weight).toFixed(2)} lbs</td>
        <td style="text-align:right">$${Number(item.price_per_lb).toFixed(4)}/lb${
          item.is_price_override
            ? `<br><small style="color:#999;text-decoration:line-through">$${Number(item.original_price_per_lb ?? item.price_per_lb).toFixed(4)}/lb</small>`
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
    ? `<img src="${company.logo_url}" style="max-width:120px;max-height:80px;object-fit:contain;margin-bottom:8px;" />`
    : '';
  const addressHtml = company?.address
    ? `<div style="font-size:12px;color:#666;margin-bottom:2px;">${escapeHtml(company.address).replace(/\n/g, '<br>')}</div>`
    : '';
  const companyPhoneHtml = company?.phone
    ? `<div style="font-size:12px;color:#666;">${escapeHtml(company.phone)}</div>`
    : '';

  const signatureHtml = receipt.signature_uri
    ? `<div style="margin-top:24px;border-top:1px solid #ccc;padding-top:12px;">
        <p style="margin:0 0 8px;font-size:12px;color:#666;">Customer Signature</p>
        <img src="${receipt.signature_uri}" style="max-width:300px;height:100px;object-fit:contain;" />
      </div>`
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, sans-serif; padding: 24px; color: #222; max-width: 80mm; margin: 0 auto; }
        .company-header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #222; padding-bottom: 12px; }
        h1 { font-size: 22px; margin: 0 0 4px; }
        .receipt-number { color: #666; font-size: 14px; margin-bottom: 16px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; }
        .info-label { color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { text-align: left; border-bottom: 2px solid #222; padding: 8px 4px; font-size: 13px; }
        td { padding: 8px 4px; border-bottom: 1px solid #eee; font-size: 13px; }
        .total-row { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 12px; border-top: 2px solid #222; }
        .total-label { font-size: 18px; font-weight: bold; }
        .total-value { font-size: 22px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="company-header">
        ${logoHtml}
        <h1>${companyName}</h1>
        ${addressHtml}
        ${companyPhoneHtml}
      </div>

      <div class="receipt-number">${receipt.receipt_number}</div>

      <div class="info-row">
        <span class="info-label">Customer</span>
        <span>${escapeHtml(receipt.customer_name)}</span>
      </div>
      ${receipt.customer_phone ? `<div class="info-row"><span class="info-label">Phone</span><span>${escapeHtml(receipt.customer_phone)}</span></div>` : ''}
      ${receipt.vehicle_plate ? `<div class="info-row"><span class="info-label">Vehicle</span><span>${escapeHtml(receipt.vehicle_plate)} ${escapeHtml(receipt.vehicle_description ?? '')}</span></div>` : ''}
      <div class="info-row">
        <span class="info-label">Date</span>
        <span>${date}</span>
      </div>
      ${receipt.seller_affirmed ? '<div class="info-row"><span class="info-label">Seller Affirmed</span><span>Yes</span></div>' : ''}

      <table>
        <thead>
          <tr>
            <th>Metal</th>
            <th style="text-align:right">Weight</th>
            <th style="text-align:right">Price</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHtml}
        </tbody>
      </table>

      <div class="total-row">
        <span class="total-label">Total</span>
        <span class="total-value">$${Number(receipt.subtotal).toFixed(2)}</span>
      </div>

      ${signatureHtml}
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
  await Print.printAsync({ html });
}

export { type PrintReceiptData };
