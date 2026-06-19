import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { elevateAdmin } from '../services/admin';
import { useT } from '../hooks/useT';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../constants';
import { useTheme, useThemedStyles } from '../theme';

interface AdminElevationModalProps {
  visible: boolean;
  requireOwner: boolean;
  onSuccess: (expiresAt: number, isOwner: boolean) => void;
  onCancel: () => void;
}

// Prompts for an admin/owner PIN and opens a server-side elevation window. Used
// by AdminElevationProvider to gate privileged screens.
export default function AdminElevationModal({
  visible,
  requireOwner,
  onSuccess,
  onCancel,
}: AdminElevationModalProps) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPin('');
      setError('');
    }
  }, [visible]);

  const handleVerify = async () => {
    if (pin.length < 4) return;
    setVerifying(true);
    setError('');
    try {
      const expiresAt = await elevateAdmin(pin, requireOwner);
      onSuccess(expiresAt, requireOwner);
    } catch (e) {
      setError((e as Error).message || t.verificationFailed);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>
            {requireOwner ? t.ownerAuthorization : t.adminAuthorization}
          </Text>
          <Text style={styles.subtitle}>{t.enterPinToAuthorize}</Text>

          <TextInput
            style={styles.codeInput}
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            placeholder="0000"
            placeholderTextColor={colors.textTertiary}
            maxLength={4}
            secureTextEntry
            autoFocus
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={verifying}
            >
              <Text style={styles.cancelButtonText}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.verifyButton, verifying && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={verifying || pin.length < 4}
            >
              {verifying ? (
                <ActivityIndicator color={colors.accentInk} />
              ) : (
                <Text style={styles.verifyButtonText}>{t.authorize}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    modal: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 400,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      color: colors.warning,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    codeInput: {
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      fontSize: fontSize.xxl,
      fontFamily: fonts.sans,
      textAlign: 'center',
      letterSpacing: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    errorText: {
      color: colors.danger,
      fontSize: fontSize.sm,
      fontFamily: fonts.sans,
      textAlign: 'center',
      marginBottom: spacing.md,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    cancelButton: {
      flex: 1,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansSemiBold,
    },
    verifyButton: {
      flex: 1,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    verifyButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
  });
