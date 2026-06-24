import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResponsiveContainer } from '../../components';
import { setPin } from '../../services/pin';
import { useT } from '../../hooks/useT';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

// Shown once after sign-in for an admin/owner who has no PIN yet. A PIN is
// required to open admin-elevation windows, so without one they'd be locked out
// of admin work. Gated in RootNavigator on current_user_has_pin().
export default function SetAdminPinScreen({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [pin, setPinValue] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (pin.length !== 4) return;
    if (pin !== confirm) {
      setError(t.pinMismatch);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await setPin(pin);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ResponsiveContainer maxWidth={420}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.setPinTitle}</Text>
          <Text style={styles.subtitle}>{t.setPinSubtitle}</Text>

          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={setPinValue}
            keyboardType="number-pad"
            placeholder="0000"
            placeholderTextColor={colors.textTertiary}
            maxLength={4}
            secureTextEntry
            autoFocus
          />
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            keyboardType="number-pad"
            placeholder={t.confirmPinLabel}
            placeholderTextColor={colors.textTertiary}
            maxLength={4}
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[
              styles.saveButton,
              (saving || pin.length !== 4 || confirm.length !== 4) &&
                styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={saving || pin.length !== 4 || confirm.length !== 4}
          >
            {saving ? (
              <ActivityIndicator color={colors.accentInk} />
            ) : (
              <Text style={styles.saveButtonText}>{t.savePin}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ResponsiveContainer>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      padding: spacing.lg,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
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
    input: {
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
    saveButton: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.accent,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
  });
