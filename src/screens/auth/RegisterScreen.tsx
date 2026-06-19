import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { ResponsiveContainer } from '../../components';
import { useAppDispatch } from '../../store';
import { signUp } from '../../store/authStore';
import { useT } from '../../hooks/useT';
import { useTheme, useThemedStyles } from '../../theme';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

type FieldKey = 'email' | 'password' | 'confirm' | 'code';

export default function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [focused, setFocused] = useState<FieldKey | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  const handleRegister = async () => {
    const trimmedEmail = email.trim();
    const trimmedCode = inviteCode.trim().toUpperCase();
    if (!trimmedEmail || !password || !confirmPassword || !trimmedCode) {
      Alert.alert(t.error, t.fillAllFields);
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t.error, t.passwordsMismatch);
      return;
    }

    setLoading(true);
    try {
      await dispatch(
        signUp({
          email: trimmedEmail,
          password,
          inviteCode: trimmedCode,
        })
      ).unwrap();
      Alert.alert(t.success, t.accountCreated, [
        { text: t.ok, onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      Alert.alert(t.registrationFailed, (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContainer maxWidth={420}>
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoWrap}>
              <Ionicons
                name="person-add-outline"
                size={24}
                color={colors.accent}
              />
            </View>
            <Text style={styles.eyebrow}>{t.appName}</Text>
            <Text style={styles.title}>{t.createAccount}</Text>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.email}</Text>
              <TextInput
                style={[
                  styles.input,
                  focused === 'email' && styles.inputFocused,
                ]}
                placeholder={t.email}
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.password}</Text>
              <TextInput
                style={[
                  styles.input,
                  focused === 'password' && styles.inputFocused,
                ]}
                placeholder={t.password}
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t.confirmPassword}</Text>
              <TextInput
                style={[
                  styles.input,
                  focused === 'confirm' && styles.inputFocused,
                ]}
                placeholder={t.confirmPassword}
                placeholderTextColor={colors.textTertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onFocus={() => setFocused('confirm')}
                onBlur={() => setFocused(null)}
                secureTextEntry
              />
            </View>

            <View style={[styles.field, { marginBottom: 0 }]}>
              <Text style={styles.fieldLabel}>{t.inviteCode}</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.inputCode,
                  focused === 'code' && styles.inputFocused,
                ]}
                placeholder={t.inviteCode}
                placeholderTextColor={colors.textTertiary}
                value={inviteCode}
                onChangeText={setInviteCode}
                onFocus={() => setFocused('code')}
                onBlur={() => setFocused(null)}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={8}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {loading ? t.creatingAccount : t.register}
            </Text>
            {!loading && (
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.accentInk}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkWrap}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>{t.alreadyHaveAccount}</Text>
          </TouchableOpacity>
        </ResponsiveContainer>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxxl,
    },
    brand: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    logoWrap: {
      width: 56,
      height: 56,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.accentMuted,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: colors.accentLine,
    },
    eyebrow: {
      fontFamily: fonts.mono,
      fontSize: 11.5,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: fontSize.xxl,
      fontFamily: fonts.display,
      color: colors.textPrimary,
      textAlign: 'center',
      letterSpacing: -0.5,
    },
    formCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xl,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    field: {
      marginBottom: spacing.lg,
    },
    fieldLabel: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 10.5,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      fontSize: fontSize.lg,
      fontFamily: fonts.sans,
      borderWidth: 1,
      borderColor: colors.border,
    },
    inputCode: {
      fontFamily: fonts.monoMedium,
      letterSpacing: 3,
    },
    inputFocused: {
      borderColor: colors.accent,
    },
    button: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.accent,
      borderRadius: borderRadius.lg,
      paddingVertical: 16,
      marginBottom: spacing.lg,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 4,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: colors.accentInk,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
      letterSpacing: 0.3,
    },
    linkWrap: {
      paddingVertical: spacing.sm,
    },
    linkText: {
      color: colors.textSecondary,
      textAlign: 'center',
      fontSize: fontSize.md,
      fontFamily: fonts.sansMedium,
    },
  });
