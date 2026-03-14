import { useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import SignatureScreen, {
  type SignatureViewRef,
} from 'react-native-signature-canvas';
import { colors, spacing, fontSize, borderRadius } from '../constants';

/** Returns true if the data URI actually contains image data */
function isValidSignature(uri: string): boolean {
  // Reject empty data URIs like "data:," or "data:image/png;base64,"
  return uri.length > 100 && uri.startsWith('data:image');
}

export interface SignaturePadHandle {
  /** Triggers a read and resolves with the base64 data URI, or null if empty. */
  readSignature: () => Promise<string | null>;
}

interface SignaturePadProps {
  onSignatureChange?: (signature: string | null) => void;
  label?: string;
  clearLabel?: string;
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  (
    { onSignatureChange, label = 'Customer Signature', clearLabel = 'Clear' },
    ref
  ) => {
    const signatureRef = useRef<SignatureViewRef>(null);
    const latestSignature = useRef<string | null>(null);
    const pendingResolve = useRef<((val: string | null) => void) | null>(null);

    const processSignature = useCallback((raw: string): string | null => {
      return isValidSignature(raw) ? raw : null;
    }, []);

    const handleOK = useCallback(
      (signature: string) => {
        const validated = processSignature(signature);
        latestSignature.current = validated;
        onSignatureChange?.(validated);

        if (pendingResolve.current) {
          pendingResolve.current(validated);
          pendingResolve.current = null;
        }
      },
      [onSignatureChange, processSignature]
    );

    const handleEmpty = useCallback(() => {
      latestSignature.current = null;
      onSignatureChange?.(null);

      if (pendingResolve.current) {
        pendingResolve.current(null);
        pendingResolve.current = null;
      }
    }, [onSignatureChange]);

    const handleClear = useCallback(() => {
      signatureRef.current?.clearSignature();
      latestSignature.current = null;
      onSignatureChange?.(null);
    }, [onSignatureChange]);

    useImperativeHandle(ref, () => ({
      readSignature: () => {
        return new Promise<string | null>((resolve) => {
          pendingResolve.current = resolve;
          signatureRef.current?.readSignature();

          // Timeout fallback — return cached value if WebView doesn't respond
          setTimeout(() => {
            if (pendingResolve.current) {
              pendingResolve.current(latestSignature.current);
              pendingResolve.current = null;
            }
          }, 500);
        });
      },
    }));

    // Use a white background for the canvas so the signature renders correctly,
    // and use a dark pen color for contrast. This ensures trimWhitespace and
    // the exported image work reliably.
    const webStyle = `.m-signature-pad--footer { display: none; }
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    body, html { background-color: #ffffff; }
    canvas { background-color: #ffffff; }`;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <TouchableOpacity onPress={handleClear}>
            <Text style={styles.clearButton}>{clearLabel}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.signatureBox}>
          <SignatureScreen
            ref={signatureRef}
            onOK={handleOK}
            onEmpty={handleEmpty}
            onEnd={() => signatureRef.current?.readSignature()}
            webStyle={webStyle}
            backgroundColor="#ffffff"
            penColor="#222222"
            dotSize={2}
            minWidth={1.5}
            maxWidth={3}
            style={styles.signature}
          />
        </View>
      </View>
    );
  }
);

SignaturePad.displayName = 'SignaturePad';

export default SignaturePad;

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  clearButton: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  signatureBox: {
    height: 180,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  signature: {
    flex: 1,
  },
});
