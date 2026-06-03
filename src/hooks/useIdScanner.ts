import { useState } from 'react';
import { Alert } from 'react-native';
import DocumentScanner from 'react-native-document-scanner-plugin';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { parseDriversLicense } from '../utils/parseDriversLicense';
import type { ParsedIdFields } from '../types';

interface ScanResult {
  imageUri: string;
  fields: ParsedIdFields;
}

export function useIdScanner() {
  const [scanning, setScanning] = useState(false);

  const scanAndRecognize = async (): Promise<ScanResult | null> => {
    setScanning(true);
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({
        maxNumDocuments: 1,
      });

      if (!scannedImages || scannedImages.length === 0) {
        return null;
      }

      const imageUri = scannedImages[0];

      const result = await recognizeText(imageUri);
      const rawText = result.blocks.map((b) => b.text).join('\n');
      const fields = parseDriversLicense(rawText);

      return { imageUri, fields };
    } catch (err) {
      Alert.alert('Scan Error', (err as Error).message);
      return null;
    } finally {
      setScanning(false);
    }
  };

  return { scanning, scanAndRecognize };
}
