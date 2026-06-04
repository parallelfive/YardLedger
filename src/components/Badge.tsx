import { Text, StyleSheet } from 'react-native';
import { type Palette, borderRadius, fonts } from '../constants';
import { useTheme } from '../theme';

type BadgeVariant = 'danger' | 'warning' | 'success' | 'accent';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const makeBadgeColors = (colors: Palette) =>
  ({
    danger: { text: colors.rust, bg: 'rgba(181, 70, 47, 0.16)' },
    warning: { text: colors.gold, bg: colors.gold + '29' },
    success: { text: colors.moss, bg: 'rgba(93, 122, 78, 0.16)' },
    accent: { text: colors.accent, bg: colors.accentMuted },
  }) as const;

export default function Badge({ label, variant = 'danger' }: BadgeProps) {
  const { colors } = useTheme();
  const c = makeBadgeColors(colors)[variant];

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
