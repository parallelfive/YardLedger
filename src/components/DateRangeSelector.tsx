import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useT } from '../hooks/useT';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../constants';
import { useThemedStyles } from '../theme';
import type { DatePreset } from '../utils/dateRange';

// getDateRange + DatePreset live in utils/dateRange (a pure, node-testable
// module) so the tz-aware range logic (#111) has unit coverage without pulling
// the RN module graph into vitest. Re-exported here so existing
// `from '../components/DateRangeSelector'` imports keep working.
export { getDateRange } from '../utils/dateRange';
export type { DatePreset } from '../utils/dateRange';

interface DateRangeSelectorProps {
  selected: DatePreset;
  onSelect: (preset: DatePreset) => void;
}

export default function DateRangeSelector({
  selected,
  onSelect,
}: DateRangeSelectorProps) {
  const { t } = useT();
  const styles = useThemedStyles(makeStyles);

  const presets: { key: DatePreset; label: string }[] = [
    { key: 'today', label: t.today },
    { key: 'week', label: t.thisWeek },
    { key: 'month', label: t.thisMonth },
  ];

  return (
    <View style={styles.container}>
      {presets.map((preset) => (
        <TouchableOpacity
          key={preset.key}
          style={[styles.pill, selected === preset.key && styles.pillActive]}
          onPress={() => onSelect(preset.key)}
        >
          <Text
            style={[
              styles.pillText,
              selected === preset.key && styles.pillTextActive,
            ]}
          >
            {preset.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    pill: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.pill,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    pillText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    pillTextActive: {
      color: colors.accentInk,
    },
  });
