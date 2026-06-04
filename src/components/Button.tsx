import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { TouchableOpacityProps } from 'react-native';
import { colors, spacing, fontSize, borderRadius, fonts } from '../constants';

type ButtonVariant = 'primary' | 'danger' | 'outline' | 'success';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  small?: boolean;
}

const variantStyles = {
  primary: { bg: colors.accent, text: colors.background },
  danger: { bg: colors.danger, text: colors.white },
  outline: { bg: 'transparent', text: colors.textPrimary },
  success: { bg: colors.success, text: colors.background },
} as const;

export default function Button({
  title,
  variant = 'primary',
  loading = false,
  small = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const v = variantStyles[variant];

  return (
    <TouchableOpacity
      style={[
        styles.base,
        small && styles.small,
        { backgroundColor: v.bg },
        variant === 'outline' && styles.outline,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text
          style={[styles.text, small && styles.textSmall, { color: v.text }]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  small: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.sm,
    shadowOpacity: 0,
    elevation: 0,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: fontSize.sm,
    fontFamily: fonts.sansSemiBold,
  },
});
