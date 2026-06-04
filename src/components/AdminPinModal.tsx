import { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useAdminVerification } from '../hooks/useAdminVerification';
import { useT } from '../hooks/useT';
import { colors, spacing, fontSize, borderRadius, fonts } from '../constants';

interface AdminPinModalProps {
  visible: boolean;
  onSuccess: (adminUserId: string) => void;
  onCancel: () => void;
}

export default function AdminPinModal({
  visible,
  onSuccess,
  onCancel,
}: AdminPinModalProps) {
  const { t } = useT();
  const { verify, loading, error, reset } = useAdminVerification();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setEmail('');
      setPassword('');
      reset();
    }
  }, [visible, reset]);

  const handleVerify = async () => {
    const userId = await verify(email, password);
    if (userId) {
      onSuccess(userId);
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
          <Text style={styles.title}>{t.adminAuthorization}</Text>
          <Text style={styles.subtitle}>{t.priceOverrideRequiresAdmin}</Text>

          <TextInput
            style={styles.input}
            placeholder={t.adminEmail}
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <TextInput
            ref={passwordRef}
            style={styles.input}
            placeholder={t.adminPassword}
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleVerify}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading}
            >
              <Text style={styles.verifyButtonText}>
                {loading ? t.verifying : t.authorize}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    color: colors.danger,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    fontSize: fontSize.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.sm,
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
    padding: spacing.lg,
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
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
  },
});
