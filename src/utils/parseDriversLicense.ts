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
  // Look for labeled DL number: "DL 1234567", "LIC NO: AB123", "ID: 12345678".
  // \b on both sides so the label only matches a whole token — without it, "ID"
  // matches inside "IDENTIFICATION" and yields a bogus "ENTIFICATION".
  const labeled =
    /\b(?:dl|driver\s*(?:license|lic)|lic(?:ense)?|id)\b\s*(?:no\.?|number|#|:)?\s*[:-]?\s*([\da-z]{4,15})/i;
  const match = labeled.exec(text);
  if (match) return match[1].toUpperCase();

  // Common state formats: letter + 7-12 digits (CA, NY, TX, FL, etc.)
  const stateFormat = /\b([A-Z]\d{7,12})\b/;
  const stateMatch = stateFormat.exec(text);
  if (stateMatch) return stateMatch[1];

  return null;
}

function extractDob(text: string): string | null {
  // Look for labeled DOB
  const labeled =
    /(?:dob|date\s*of\s*birth|bd|born)\s*[:-]?\s*((?:\d{1,2}[/-]){2}\d{2,4})/i;
  const match = labeled.exec(text);
  if (match) return normalizeDateToISO(match[1]);

  // Look for any date that looks like a birth date (not expiration)
  // Avoid dates labeled EXP, ISS, etc.
  const expPattern =
    /(?:exp|is{2}|is{2}ued|expires?)\s*[:-]?\s*(?:\d{1,2}[/-]){2}\d{2,4}/gi;
  const cleaned = text.replace(expPattern, '');

  const datePattern = /\b((?:\d{1,2}[/-]){2}\d{4})\b/;
  const dateMatch = datePattern.exec(cleaned);
  if (dateMatch) return normalizeDateToISO(dateMatch[1]);

  return null;
}

function extractName(lines: string[]): string | null {
  // Look for labeled name fields (AAMVA standard: FN, LN, DAC, DCS)
  for (const line of lines) {
    const fnMatch = /(?:fn|first\s*name|dac)\s*[:-]?\s*([a-z][\s'a-z-]+)/i.exec(
      line
    );
    const lnMatch = /(?:ln|last\s*name|dcs)\s*[:-]?\s*([a-z][\s'a-z-]+)/i.exec(
      line
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
    if (/^[A-Z][\s',A-Z-]{3,40}$/.test(line) && !/\d/.test(line)) {
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
    // These dates are birth dates (extractDob), so a 2-digit year must land in
    // the PAST. Pivot on the current 2-digit year rather than a fixed 50, so
    // e.g. "50" is 1950 (not a future 2050) while "20" stays 2020 (#20).
    const currentYY = new Date().getFullYear() % 100;
    year = yr > currentYY ? `19${year}` : `20${year}`;
  }

  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
