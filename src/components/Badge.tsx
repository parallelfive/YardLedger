import { Text, StyleSheet } from 'react-native';
import { colors, borderRadius, fonts } from '../constants';

type BadgeVariant = 'danger' | 'warning' | 'success' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const badgeColors = {
  danger: { text: colors.rust, bg: 'rgba(181, 70, 47, 0.16)' },
  warning: { text: colors.gold, bg: 'rgba(176, 138, 50, 0.16)' },
  success: { text: colors.moss, bg: 'rgba(93, 122, 78, 0.16)' },
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
    fontSize: 11,
    fontFamily: fonts.sansBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
});
