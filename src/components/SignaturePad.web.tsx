import { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../constants';
import { useThemedStyles } from '../theme';

// Must match the native SignaturePad.tsx handle so importers typecheck on both
// platforms.
export interface SignaturePadHandle {
  readSignature: () => Promise<string | null>;
  clear: () => void;
}

interface SignaturePadProps {
  onSignatureChange?: (signature: string | null) => void;
  label?: string;
  clearLabel?: string;
}

// Web placeholder. The native build uses react-native-signature-canvas (a
// WebView-backed pad that can't load in a browser). Tapping records a
// placeholder so the buy flow can be exercised on web; a real canvas-based web
// signature (or a USB signature pad on desktop) is a follow-up.
const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  (
    { onSignatureChange, label = 'Customer Signature', clearLabel = 'Clear' },
    ref
  ) => {
    const styles = useThemedStyles(makeStyles);
    const [sig, setSig] = useState<string | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        readSignature: async () => sig,
        clear: () => {
          setSig(null);
          onSignatureChange?.(null);
        },
      }),
      [sig, onSignatureChange]
    );

    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={[styles.pad, sig ? styles.padSigned : null]}
          onPress={() => {
            const v = `web-signed-${Date.now()}`;
            setSig(v);
            onSignatureChange?.(v);
          }}
        >
          <Text style={styles.padText}>
            {sig ? '✓ Signed (web placeholder)' : 'Tap to sign (web)'}
          </Text>
        </TouchableOpacity>
        {sig ? (
          <TouchableOpacity
            onPress={() => {
              setSig(null);
              onSignatureChange?.(null);
            }}
          >
            <Text style={styles.clear}>{clearLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
export default SignaturePad;

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    label: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
    },
    pad: {
      height: 120,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    padSigned: { borderStyle: 'solid', borderColor: colors.accent },
    padText: {
      color: colors.textTertiary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
    },
    clear: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
      alignSelf: 'flex-end',
    },
  });
