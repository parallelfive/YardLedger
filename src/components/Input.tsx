import { TextInput, StyleSheet } from 'react-native';
import type { TextInputProps } from 'react-native';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../constants';
import { useTheme, useThemedStyles } from '../theme';

interface InputProps extends TextInputProps {
  /** Override default placeholder color */
  placeholderColor?: string;
}

export default function Input({
  placeholderColor,
  style,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const pc = placeholderColor ?? colors.textTertiary;
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={pc}
      {...props}
    />
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    input: {
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
      fontSize: fontSize.lg,
      fontFamily: fonts.sans,
      borderWidth: 1,
      borderColor: colors.border,
    },
  });
