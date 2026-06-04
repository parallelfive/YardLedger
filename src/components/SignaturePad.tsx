import {
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
} from 'react-native';
import SignatureScreen, {
  type SignatureViewRef,
} from 'react-native-signature-canvas';
import { colors, spacing, fontSize, borderRadius, fonts } from '../constants';
import { useT } from '../hooks/useT';

/** Returns true if the data URI actually contains image data */
function isValidSignature(uri: string): boolean {
  return uri.length > 100 && uri.startsWith('data:image');
}

export interface SignaturePadHandle {
  readSignature: () => Promise<string | null>;
  clear: () => void;
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
    const { t } = useT();
    const signatureRef = useRef<SignatureViewRef>(null);
    const latestSignature = useRef<string | null>(null);
    const pendingResolve = useRef<((val: string | null) => void) | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [previewUri, setPreviewUri] = useState<string | null>(null);

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
      setPreviewUri(null);
      onSignatureChange?.(null);
    }, [onSignatureChange]);

    const handleDone = useCallback(() => {
      // Read signature, wait for onOK, then close
      const promise = new Promise<string | null>((resolve) => {
        pendingResolve.current = resolve;
        signatureRef.current?.readSignature();
        // Fallback if WebView doesn't respond
        setTimeout(() => {
          if (pendingResolve.current) {
            pendingResolve.current(latestSignature.current);
            pendingResolve.current = null;
          }
        }, 800);
      });
      promise.then((sig) => {
        setPreviewUri(sig);
        setModalVisible(false);
      });
    }, []);

    const handleModalClose = useCallback(() => {
      const promise = new Promise<string | null>((resolve) => {
        pendingResolve.current = resolve;
        signatureRef.current?.readSignature();
        setTimeout(() => {
          if (pendingResolve.current) {
            pendingResolve.current(latestSignature.current);
            pendingResolve.current = null;
          }
        }, 800);
      });
      promise.then((sig) => {
        setPreviewUri(sig);
        setModalVisible(false);
      });
    }, []);

    useImperativeHandle(ref, () => ({
      readSignature: () => {
        return new Promise<string | null>((resolve) => {
          if (modalVisible) {
            pendingResolve.current = resolve;
            signatureRef.current?.readSignature();
            setTimeout(() => {
              if (pendingResolve.current) {
                pendingResolve.current(latestSignature.current);
                pendingResolve.current = null;
              }
            }, 500);
          } else {
            resolve(latestSignature.current);
          }
        });
      },
      clear: () => {
        signatureRef.current?.clearSignature();
        latestSignature.current = null;
        setPreviewUri(null);
      },
    }));

    const webStyle = `.m-signature-pad--footer { display: none; }
    .m-signature-pad { box-shadow: none; border: none; }
    .m-signature-pad--body { border: none; }
    body, html { background-color: #ffffff; }
    canvas { background-color: #ffffff; }`;

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          {previewUri && (
            <TouchableOpacity onPress={handleClear}>
              <Text style={styles.clearButton}>{clearLabel}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tappable preview area */}
        <TouchableOpacity
          style={styles.signatureBox}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.tapPrompt}>{t.tapToSign}</Text>
          )}
        </TouchableOpacity>

        {/* Full-screen signature modal */}
        <Modal
          visible={modalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleModalClose}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={handleClear}>
                <Text style={styles.modalClearText}>{clearLabel}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={handleDone}>
                <Text style={styles.modalDoneText}>{t.done}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalCanvasContainer}>
              <View style={styles.modalCanvas}>
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
              <Text style={styles.modalHint}>Sign above with your finger</Text>
            </View>
          </View>
        </Modal>
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
    fontFamily: fonts.sansBold,
  },
  clearButton: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  signatureBox: {
    height: 120,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  tapPrompt: {
    color: colors.textTertiary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sans,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
  modalClearText: {
    color: colors.danger,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
    minWidth: 60,
  },
  modalDoneText: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
    minWidth: 60,
    textAlign: 'right',
  },
  modalCanvasContainer: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  modalCanvas: {
    flex: 1,
    maxHeight: 350,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  signature: {
    flex: 1,
  },
  modalHint: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
