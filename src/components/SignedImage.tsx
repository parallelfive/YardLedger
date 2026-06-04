import { useState, useEffect } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { signPrivatePath } from '../services/storage';

interface Props {
  /** A private-bucket object path, a full URL, or a data URI. */
  value: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

// Renders an image from a stored value that may be a private storage PATH
// (signed on demand), a full URL, or a data URI. Keeps PII photo paths out of
// the persisted record while still displaying them.
export default function SignedImage({ value, style, resizeMode }: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    signPrivatePath(value)
      .then((u) => {
        if (active) setUri(u);
      })
      .catch(() => {
        if (active) setUri(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (!uri) return <View style={style} />;
  return <Image source={{ uri }} style={style} resizeMode={resizeMode} />;
}
