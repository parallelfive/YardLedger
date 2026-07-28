import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

// Read a picked/captured image URI into bytes for a Supabase Storage upload,
// on both native and web. expo-file-system's `File` can only read a native
// `file://` path — on web (react-native-web) the image picker / webcam hand back
// `data:` or `blob:`/`http` URLs it can't read, which silently broke the company
// logo and customer-ID uploads (#104/#109). Branch by source:
//   - data: URL          → decode the inline base64 (both platforms)
//   - web (blob:/http)   → fetch the bytes
//   - native file://     → expo-file-system base64 (reliable on device)
// Returns an ArrayBuffer, which Supabase Storage .upload() accepts directly.
export async function readImageBytes(uri: string): Promise<ArrayBuffer> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    if (comma < 0) throw new Error('Malformed data URL for image upload');
    return decode(uri.slice(comma + 1));
  }
  if (Platform.OS === 'web') {
    return await (await fetch(uri)).arrayBuffer();
  }
  return decode(await new File(uri).base64());
}
