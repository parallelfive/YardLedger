import type { ParsedIdFields } from '../types';

/**
 * Attempts to extract structured fields from raw OCR text of a US driver's license.
 * Returns null for any field it cannot confidently extract.
 */
export function parseDriversLicense(rawText: string): ParsedIdFields {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const full = lines.join(' ');

  return {
    name: extractName(lines),
    address: extractAddress(lines),
    dob: extractDob(full),
    driversLicense: extractDlNumber(full),
  };
}

function extractDlNumber(text: string): string | null {
  // Look for labeled DL number: "DL 1234567", "LIC NO: AB123", "ID: 12345678"
  const labeled =
    /(?:DL|DRIVER\s*(?:LICENSE|LIC)|LIC(?:ENSE)?|ID)\s*(?:NO\.?|NUMBER|#|:)?\s*[:-]?\s*([A-Z0-9]{4,15})/i;
  const match = text.match(labeled);
  if (match) return match[1].toUpperCase();

  // Common state formats: letter + 7-12 digits (CA, NY, TX, FL, etc.)
  const stateFormat = /\b([A-Z]\d{7,12})\b/;
  const stateMatch = text.match(stateFormat);
  if (stateMatch) return stateMatch[1];

  return null;
}

function extractDob(text: string): string | null {
  // Look for labeled DOB
  const labeled =
    /(?:DOB|DATE\s*OF\s*BIRTH|BD|BORN)\s*[:-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i;
  const match = text.match(labeled);
  if (match) return normalizeDateToISO(match[1]);

  // Look for any date that looks like a birth date (not expiration)
  // Avoid dates labeled EXP, ISS, etc.
  const expPattern =
    /(?:EXP|ISS|ISSUED|EXPIRES?)\s*[:-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/gi;
  const cleaned = text.replace(expPattern, '');

  const datePattern = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{4})\b/;
  const dateMatch = cleaned.match(datePattern);
  if (dateMatch) return normalizeDateToISO(dateMatch[1]);

  return null;
}

function extractName(lines: string[]): string | null {
  // Look for labeled name fields (AAMVA standard: FN, LN, DAC, DCS)
  for (const line of lines) {
    const fnMatch = line.match(
      /(?:FN|FIRST\s*NAME|DAC)\s*[:-]?\s*([A-Z][A-Za-z\s'-]+)/i
    );
    const lnMatch = line.match(
      /(?:LN|LAST\s*NAME|DCS)\s*[:-]?\s*([A-Z][A-Za-z\s'-]+)/i
    );
    if (fnMatch || lnMatch) {
      const parts = [lnMatch?.[1]?.trim(), fnMatch?.[1]?.trim()].filter(
        Boolean
      );
      if (parts.length > 0) return parts.join(', ');
    }
  }

  // Look for a line that's all caps and looks like a name (2-4 words, no digits)
  for (const line of lines) {
    if (/^[A-Z][A-Z\s,'-]{3,40}$/.test(line) && !/\d/.test(line)) {
      const words = line.split(/[\s,]+/).filter(Boolean);
      if (words.length >= 2 && words.length <= 4) {
        return line;
      }
    }
  }

  return null;
}

function extractAddress(lines: string[]): string | null {
  // Find a line starting with a street number
  let addressStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\d+\s+[A-Za-z]/.test(lines[i])) {
      addressStart = i;
      break;
    }
  }

  if (addressStart === -1) return null;

  // Collect address lines until we hit a zip code line (inclusive)
  const parts: string[] = [];
  for (let i = addressStart; i < lines.length && i < addressStart + 3; i++) {
    parts.push(lines[i]);
    if (/\d{5}(-\d{4})?/.test(lines[i])) break;
  }

  return parts.length > 0 ? parts.join(', ') : null;
}

function normalizeDateToISO(dateStr: string): string {
  const parts = dateStr.split(/[/-]/);
  if (parts.length !== 3) return dateStr;

  const [month, day] = parts;
  let year = parts[2];
  if (year.length === 2) {
    const yr = parseInt(year, 10);
    year = yr > 50 ? `19${year}` : `20${year}`;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
