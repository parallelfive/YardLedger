import type { ParsedIdFields } from '../types';

// Parser for the PDF417 barcode on the back of US/Canadian driver's licenses
// (AAMVA DL/ID Card Design Standard). A USB barcode scanner at a desktop
// counter emits this raw string as keyboard input; parsing it fills the seller
// ID far more reliably than camera OCR of the front.
//
// The payload is a set of newline-separated data elements, each a 3-letter
// element ID followed by its value. We read the subset relevant to seller ID.
// Reference element IDs:
//   DAQ customer/license number   DCS family (last) name   DAC first name
//   DAD middle name(s)            DBB date of birth        DAG street address
//   DAI city                     DAJ jurisdiction (state) DAK postal code
//   DCG country                  DAA full name (legacy: LAST,FIRST,MIDDLE)

const ELEMENT_RE = /^([A-Z]{3})(.*)$/;

// Standard AAMVA element codes, used as boundaries by the no-newline fallback
// tokenizer. Includes the fields we read plus common neighbors so a value is
// sliced cleanly up to the next real code.
const KNOWN_CODES = [
  'DCA',
  'DCB',
  'DCD',
  'DBA',
  'DCS',
  'DAC',
  'DAD',
  'DBD',
  'DBB',
  'DBC',
  'DAU',
  'DAY',
  'DAG',
  'DAI',
  'DAJ',
  'DAK',
  'DAQ',
  'DCF',
  'DCG',
  'DAH',
  'DAZ',
  'DCI',
  'DCJ',
  'DCK',
  'DBN',
  'DBG',
  'DBS',
  'DCU',
  'DCE',
  'DCL',
  'DDA',
  'DDB',
  'DDC',
  'DDD',
  'DAW',
  'DAX',
  'DDE',
  'DDF',
  'DDG',
  'DAB',
  'DCT',
  'DAA',
];

// Heuristic gate: real AAMVA payloads carry the "ANSI " compliance header (and
// usually the "@" + record separators). Lets callers cheaply reject a normal
// typed value before attempting a parse.
export function looksLikeAamva(raw: string): boolean {
  return (
    /ANSI\s|^@/.test(raw.trim().slice(0, 32)) && /D(AQ|CS|AC|BB)/.test(raw)
  );
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .trim();
}

// AAMVA dates are 8 digits: US uses MMDDCCYY, Canada CCYYMMDD. Normalize to
// MM/DD/YYYY to match the manual DOB field.
function normalizeDate(
  value: string,
  country: string | undefined
): string | null {
  const d = value.replace(/\D/g, '');
  if (d.length !== 8) return null;
  let mm: string, dd: string, yyyy: string;
  if (country === 'CAN') {
    yyyy = d.slice(0, 4);
    mm = d.slice(4, 6);
    dd = d.slice(6, 8);
  } else {
    mm = d.slice(0, 2);
    dd = d.slice(2, 4);
    yyyy = d.slice(4, 8);
  }
  const mi = Number(mm);
  const di = Number(dd);
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null;
  return `${mm}/${dd}/${yyyy}`;
}

/**
 * Parse a raw AAMVA PDF417 barcode payload into seller ID fields. Returns null
 * for any field it can't confidently extract; returns all-null if the payload
 * isn't recognizable AAMVA data.
 */
export function parseAamva(raw: string): ParsedIdFields {
  const empty: ParsedIdFields = {
    name: null,
    address: null,
    dob: null,
    driversLicense: null,
    city: null,
    state: null,
    zip: null,
    stateOfIssue: null,
  };
  if (!raw) return empty;

  let fields: Record<string, string> = {};
  for (const line of raw.split(/[\r\n]+/)) {
    const m = ELEMENT_RE.exec(line.trim());
    if (!m) continue;
    const [, id, value] = m;
    // First occurrence wins; header tokens (e.g. "ANS"/"ANSI") get overwritten
    // by real elements or are ignored downstream.
    if (!(id in fields) && value.trim()) fields[id] = value.trim();
  }

  // Fallback: if the separators were lost (e.g. a single-line input that
  // stripped newlines), tokenize on the known element codes instead. Each code
  // captures everything up to the next known code.
  if (Object.keys(fields).length < 3) {
    fields = {};
    const alt = KNOWN_CODES.join('|');
    const re = new RegExp(`(${alt})((?:(?!${alt})[\\s\\S])*)`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const id = m[1];
      const value = m[2].trim();
      if (!(id in fields) && value) fields[id] = value;
    }
  }

  const country = fields.DCG?.toUpperCase();

  // Name: prefer discrete first/last; fall back to legacy DAA "LAST,FIRST,MID".
  let name: string | null = null;
  const first = fields.DAC ?? fields.DCT; // DCT = given name in some versions
  const last = fields.DCS ?? fields.DAB; // DAB = family name in some versions
  if (first || last) {
    const middle = fields.DAD && fields.DAD !== first ? fields.DAD : '';
    name = titleCase([first, middle, last].filter(Boolean).join(' ')) || null;
  } else if (fields.DAA) {
    const parts = fields.DAA.split(',').map((p) => p.trim());
    // Legacy order is LAST,FIRST,MIDDLE — reassemble as First Middle Last.
    const [l, f, mid] = parts;
    name = titleCase([f, mid, l].filter(Boolean).join(' ')) || null;
  }

  const zipRaw = fields.DAK?.replace(/\D/g, '') ?? '';
  const zip = zipRaw ? zipRaw.slice(0, 5) : null;
  const state = fields.DAJ?.toUpperCase().slice(0, 2) || null;

  return {
    name,
    // Strip AAMVA street-address filler/truncation markers.
    address: fields.DAG ? titleCase(fields.DAG) : null,
    dob: fields.DBB ? normalizeDate(fields.DBB, country) : null,
    driversLicense: fields.DAQ ? fields.DAQ.toUpperCase() : null,
    city: fields.DAI ? titleCase(fields.DAI) : null,
    state,
    zip,
    // The holder's jurisdiction is the issuing state in the overwhelmingly
    // common in-state case; DAJ is the reliable, present field for it.
    stateOfIssue: state,
  };
}
