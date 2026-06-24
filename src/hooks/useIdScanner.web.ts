import { useState } from 'react';
import type { ParsedIdFields } from '../types';

interface ScanResult {
  imageUri: string;
  fields: ParsedIdFields;
}

// Web has no camera document scanner / ML Kit OCR. ID is entered manually for
// now; the planned desktop path is a USB PDF417 barcode scanner. Returns null
// so callers fall through to the manual fields.
export function useIdScanner() {
  const [scanning] = useState(false);
  const scanAndRecognize = async (): Promise<ScanResult | null> => null;
  return { scanning, scanAndRecognize };
}
