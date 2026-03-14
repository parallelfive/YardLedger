import { Text, StyleSheet } from 'react-native';
import { colors, fontSize, borderRadius } from '../constants';

type BadgeVariant = 'danger' | 'warning' | 'success' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const badgeColors = {
  danger: { text: colors.danger, bg: 'rgba(248, 81, 73, 0.15)' },
  warning: { text: colors.warning, bg: 'rgba(210, 153, 34, 0.15)' },
  success: { text: colors.success, bg: 'rgba(86, 211, 100, 0.15)' },
  accent: { text: colors.accent, bg: colors.accentMuted },
} as const;

export default function Badge({ label, variant = 'danger' }: BadgeProps) {
  const c = badgeColors[variant];

  return (
    <Text style={[styles.badge, { color: c.text, backgroundColor: c.bg }]}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    fontSize: fontSize.xs,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
});
