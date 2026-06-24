import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

// Write a text payload to a temporary cache file and hand it to the OS share
// sheet. These exports (compliance CSVs, receipt data) carry regulated seller
// PII, so the cached copy is purged once the share sheet closes — it must not
// linger at rest in the app's cache dir.
//
// The web build resolves shareFile.web.ts instead (browser download).
export async function shareTextFile(
  filename: string,
  content: string,
  mimeType: string,
  uti?: string
): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.write(content);
  try {
    await Sharing.shareAsync(file.uri, { mimeType, UTI: uti });
  } finally {
    try {
      file.delete();
    } catch {
      /* best effort */
    }
  }
}
