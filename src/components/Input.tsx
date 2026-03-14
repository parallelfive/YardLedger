import { TextInput, StyleSheet } from 'react-native';
import type { TextInputProps } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../constants';

interface InputProps extends TextInputProps {
  /** Override default placeholder color */
  placeholderColor?: string;
}

export default function Input({
  placeholderColor = colors.textTertiary,
  style,
  ...props
}: InputProps) {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={placeholderColor}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: fontSize.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
