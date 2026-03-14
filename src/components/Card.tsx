import { View, StyleSheet } from 'react-native';
import type { ViewProps } from 'react-native';
import { colors, spacing, borderRadius } from '../constants';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  /** Show a colored left accent border */
  accentColor?: string;
}

export default function Card({
  children,
  style,
  accentColor,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.card,
        accentColor != null && {
          borderLeftWidth: 3,
          borderLeftColor: accentColor,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
