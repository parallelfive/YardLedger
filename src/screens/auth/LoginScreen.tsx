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
import { useAppDispatch } from '../../store';
import { signIn } from '../../store/authStore';
import { useT } from '../../hooks/useT';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const dispatch = useAppDispatch();
  const { t } = useT();

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      Alert.alert(t.error, t.fillAllFields);
      return;
    }

    setLoading(true);
    try {
      await dispatch(signIn({ email: trimmedEmail, password })).unwrap();
    } catch (error) {
      Alert.alert(t.loginFailed, (error as Error).message);
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
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoWrap}>
            <Ionicons
              name="hardware-chip-outline"
              size={28}
              color={colors.accent}
            />
          </View>
          <Text style={styles.eyebrow}>{t.appTagline}</Text>
          <Text style={styles.title}>{t.appName}</Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t.email}</Text>
            <TextInput
              style={[styles.input, emailFocused && styles.inputFocused]}
              placeholder={t.email}
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={setEmail}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
          </View>

          <View style={[styles.field, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>{t.password}</Text>
            <TextInput
              style={[styles.input, passwordFocused && styles.inputFocused]}
              placeholder={t.password}
              placeholderTextColor={colors.textTertiary}
              value={password}
              onChangeText={setPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry
            />
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {loading ? t.signingIn : t.signIn}
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
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.7}
        >
          <Text style={styles.linkText}>{t.noAccountRegister}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.xxl,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accentMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
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
    fontSize: fontSize.title,
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
