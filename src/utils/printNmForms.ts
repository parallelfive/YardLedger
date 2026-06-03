import * as Print from 'expo-print';
import {
  fetchCompanySettings,
  type CompanySettings,
} from '../services/companySettings';
import { escapeHtml } from './validation';

interface NmLineItem {
  metal_name: string;
  weight: number;
  total: number;
}

interface NmReceiptData {
  receipt_number: string;
  customer_name: string;
  created_at: string;
  seller_name?: string;
  seller_dl_number?: string;
  seller_state_of_issue?: string;
  seller_address?: string;
  seller_city?: string;
  seller_state?: string;
  seller_zip?: string;
  vehicle_plate?: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  customer_phone?: string;
  signature_uri?: string | null;
  seller_id_photo_uri?: string | null;
  cat_converter_numbers?: string;
  transport_vin?: string;
  cat_converter_photo_uri?: string | null;
  cat_title_photo_uri?: string | null;
  line_items: NmLineItem[];
}

let cachedSettings: CompanySettings | null = null;

async function getSettings(): Promise<CompanySettings | null> {
  if (cachedSettings) return cachedSettings;
  cachedSettings = await fetchCompanySettings();
  return cachedSettings;
}

function field(label: string, value: string | undefined): string {
  return `<tr>
    <td style="padding:4px 8px;font-weight:600;width:40%;border:1px solid #ccc">${label}</td>
    <td style="padding:4px 8px;border:1px solid #ccc">${escapeHtml(value ?? '')}</td>
  </tr>`;
}

/**
 * Generates and prints the NM Secondhand Metal Dealer's Purchase Record.
 * Mirrors the official NMRLD form (Rev. 03/2026).
 */
export async function printNmPurchaseRecord(
  receipt: NmReceiptData
): Promise<void> {
  const company = await getSettings();
  const date = new Date(receipt.created_at).toLocaleDateString();

  // Categorize line items by NM regulated material types
  const categories: Record<string, number> = {};
  const descriptions: string[] = [];
  for (const item of receipt.line_items) {
    const name = item.metal_name.toLowerCase();
    let category = '';
    if (name.includes('aluminum')) category = 'Aluminum';
    else if (name.includes('copper') || name.includes('wire'))
      category = 'Copper';
    else if (name.includes('bronze')) category = 'Bronze';
    else if (name.includes('brass')) category = 'Brass';
    else if (
      name.includes('steel') ||
      name.includes('iron') ||
      name.includes('stainless')
    )
      category = 'Steel';
    else if (name.includes('lead') || name.includes('battery'))
      category = 'Lead';

    if (category) {
      categories[category] = (categories[category] ?? 0) + Number(item.weight);
    }
    descriptions.push(
      `${escapeHtml(item.metal_name)} — ${Number(item.weight).toFixed(2)} lbs`
    );
  }

  const materialChecks = [
    'Aluminum',
    'Copper',
    'Bronze',
    'Brass',
    'Steel',
    'Lead',
  ]
    .map((cat) => {
      const checked = categories[cat] ? '&#9745;' : '&#9744;';
      const lbs = categories[cat]
        ? `${Number(categories[cat]).toFixed(2)} lbs`
        : '';
      return `<span style="margin-right:16px">${checked} ${cat}: ${lbs}</span>`;
    })
    .join('');

  const fullAddress = [
    receipt.seller_address,
    receipt.seller_city,
    receipt.seller_state
      ? `${receipt.seller_state} ${receipt.seller_zip ?? ''}`
      : receipt.seller_zip,
  ]
    .filter(Boolean)
    .join(', ');

  const vehicleDesc = [
    receipt.vehicle_year,
    receipt.vehicle_make,
    receipt.vehicle_model,
  ]
    .filter(Boolean)
    .join(' ');

  const html = `
    <html><head><style>
      body { font-family: sans-serif; padding: 20px; font-size: 12px; color: #000; }
      h2 { text-align: center; margin: 0 0 4px; }
      h3 { text-align: center; margin: 0 0 16px; font-weight: normal; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
      .section-title { font-weight: 700; font-size: 14px; margin: 16px 0 8px; border-bottom: 2px solid #000; padding-bottom: 4px; }
      .sig-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; }
      .two-col { display: flex; gap: 16px; }
      .two-col > div { flex: 1; }
    </style></head><body>
      <h2>Secondhand Metal Dealer's Purchase Record</h2>
      <h3>Per NM Sale of Recycled Metals Act §57-30</h3>

      <table>
        ${field('Date of Purchase', date)}
        ${field('Business Name', company?.company_name ?? '')}
        ${field('Location', company?.address ?? '')}
        ${field('Receipt #', receipt.receipt_number)}
      </table>

      <div class="two-col">
        <div>
          <div class="section-title">SELLER INFORMATION</div>
          <table>
            ${field('Customer Name', receipt.seller_name ?? receipt.customer_name)}
            ${field('State/ID Number', receipt.seller_dl_number)}
            ${field('State of Issue', receipt.seller_state_of_issue)}
            ${field('Address', fullAddress)}
          </table>
        </div>
        <div>
          <div class="section-title">VEHICLE INFORMATION</div>
          <table>
            ${field('License Plate #', receipt.vehicle_plate)}
            ${field('Vehicle', vehicleDesc)}
            ${field('Color', receipt.vehicle_color)}
          </table>
        </div>
      </div>

      <div class="section-title">REGULATED MATERIAL INFORMATION</div>
      <p>${materialChecks}</p>
      <p><strong>Description:</strong> ${descriptions.join('; ')}</p>

      <div class="section-title">SELLER'S STATEMENT OF OWNERSHIP</div>
      <p style="font-size:11px">
        I swear under penalty of perjury that I am the legal owner of the material reported on this
        record and have the legal right to sell this material to a secondhand metal dealer, or that I am
        legally entitled to sell the material to a secondhand metal dealer on behalf of the legal owner.
        Falsely claiming ownership of property subjects you to criminal penalties.
      </p>

      ${
        receipt.signature_uri
          ? `<img src="${receipt.signature_uri}" style="max-width:200px;max-height:80px;margin-top:8px" />`
          : ''
      }

      <div style="display:flex;gap:40px;margin-top:24px">
        <div style="flex:1">
          <div class="sig-line">Signature</div>
        </div>
        <div style="flex:1">
          <div class="sig-line">Date: ${date}</div>
        </div>
      </div>
      <div class="sig-line" style="margin-top:24px">
        Print Full Name: ${escapeHtml(receipt.seller_name ?? receipt.customer_name)}
      </div>
    </body></html>
  `;

  await Print.printAsync({ html });
}

/**
 * Generates and prints the NM Catalytic Converter Additional Documentation form.
 * Mirrors the official NMRLD form (Rev. 03/2026).
 */
export async function printNmCatConverterForm(
  receipt: NmReceiptData
): Promise<void> {
  const date = new Date(receipt.created_at).toLocaleDateString();
  const time = new Date(receipt.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const sellerName = escapeHtml(receipt.seller_name ?? receipt.customer_name);

  // Format VIN with spaces for readability
  const vin = (receipt.transport_vin ?? '').toUpperCase();
  const vinBoxes = Array.from({ length: 17 })
    .map((_, i) => {
      const ch = vin[i] ?? '';
      return `<span style="display:inline-block;width:22px;height:28px;border:1px solid #000;text-align:center;line-height:28px;font-size:14px;font-weight:bold;margin-right:2px">${ch}</span>`;
    })
    .join('');

  const html = `
    <html><head><style>
      body { font-family: sans-serif; padding: 20px; font-size: 12px; color: #000; }
      h2 { text-align: center; margin: 0 0 16px; }
      .row { display: flex; gap: 40px; margin-bottom: 8px; }
      .row span { font-weight: 600; }
      .section-title { font-weight: 700; font-size: 13px; margin: 16px 0 8px; }
      .check-item { margin: 8px 0; }
      .sig-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 4px; }
    </style></head><body>
      <h2>Catalytic Converter Additional Documentation</h2>

      <div class="row">
        <span>DATE: ${date}</span>
        <span>TIME: ${time}</span>
      </div>

      <p>
        I, <strong>${sellerName}</strong>, AFFIRM THAT I AM THE RIGHTFUL OWNER OR
        HAVE PERMISSION FROM THE RIGHTFUL OWNER OF THE MATERIAL IDENTIFIED BELOW AND I UNDERSTAND THAT
        PROVIDING FALSE INFORMATION IS A VIOLATION OF STATE AND FEDERAL LAWS.
      </p>

      <p style="font-size:11px">
        I UNDERSTAND THAT ADDITIONAL DOCUMENTATION AS PROVIDED BY THE RECYCLED METAL RULES MAY BE
        REQUIRED BY THE BUSINESS PURCHASING THIS MATERIAL BEFORE THEY WILL AGREE TO COMPLETE THE PURCHASE
        OF CERTAIN TYPES OF MATERIAL.
      </p>

      <p style="font-size:11px">
        SHOULD IT BE FOUND THAT THE MATERIAL SOLD TO THIS BUSINESS WAS NOT LAWFULLY OBTAINED, I
        UNDERSTAND AND AGREE TO REIMBURSE THIS BUSINESS AND ITS OWNERS, ALL ASSOCIATED COSTS INCLUDING,
        BUT NOT LIMITED TO: PENALTIES, LITIGATION EXPENSES, BUSINESS LOSSES, AND THE VALUE OF THE MATERIAL.
      </p>

      <div class="section-title">Catalytic Converter: MUST INCLUDE ALL BELOW</div>

      <div class="check-item">
        &#9745; Photocopy or digital image of the seller's identification document.
      </div>
      <div class="check-item">
        &#9745; Telephone number: ${escapeHtml(receipt.customer_phone ?? '')}
      </div>
      <div class="check-item">
        ${receipt.cat_title_photo_uri ? '&#9745;' : '&#9744;'} Title or registration of the vehicle the catalytic converter was removed from.
      </div>
      <div class="check-item">
        ${receipt.cat_converter_photo_uri ? '&#9745;' : '&#9744;'} Photograph of the catalytic converter.
      </div>
      <div class="check-item">
        &#9745; 17-digit Vehicle Identification Number of the transport vehicle:
      </div>
      <div style="margin:12px 0">${vinBoxes}</div>

      ${
        receipt.cat_converter_numbers
          ? `<p><strong>Converter Number(s):</strong> ${escapeHtml(receipt.cat_converter_numbers)}</p>`
          : ''
      }

      <div class="section-title">DESCRIPTION OF RESTRICTED MATERIAL:</div>
      <p>${receipt.line_items
        .filter((li) => li.metal_name.toLowerCase().includes('catalytic'))
        .map(
          (li) =>
            `${escapeHtml(li.metal_name)} — ${Number(li.weight).toFixed(2)} lbs`
        )
        .join('; ')}</p>

      ${
        receipt.cat_converter_photo_uri
          ? `<p><strong>Converter Photo:</strong></p><img src="${receipt.cat_converter_photo_uri}" style="max-width:300px;max-height:200px" />`
          : ''
      }
      ${
        receipt.cat_title_photo_uri
          ? `<p><strong>Title/Registration:</strong></p><img src="${receipt.cat_title_photo_uri}" style="max-width:300px;max-height:200px" />`
          : ''
      }
      ${
        receipt.seller_id_photo_uri
          ? `<p><strong>Seller ID:</strong></p><img src="${receipt.seller_id_photo_uri}" style="max-width:300px;max-height:200px" />`
          : ''
      }

      <div style="display:flex;gap:40px;margin-top:24px">
        <div style="flex:1">
          <div class="sig-line">SELLER SIGNATURE</div>
        </div>
        <div style="width:200px">
          <div class="sig-line">PURCHASER INITIALS</div>
        </div>
      </div>
    </body></html>
  `;

  await Print.printAsync({ html });
}
