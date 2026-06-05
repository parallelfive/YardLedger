import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../constants';
import { useTheme, useThemedStyles } from '../theme';

interface EmptyStateProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function EmptyState({
  title,
  subtitle,
  icon = 'file-tray-outline',
}: EmptyStateProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={40} color={colors.textTertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 80,
      paddingHorizontal: spacing.xxl,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    title: {
      color: colors.textSecondary,
      fontSize: fontSize.xl,
      fontFamily: fonts.sansSemiBold,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
