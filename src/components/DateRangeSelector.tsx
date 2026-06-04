import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useT } from '../hooks/useT';
import { colors, spacing, fontSize, borderRadius, fonts } from '../constants';

export type DatePreset = 'today' | 'week' | 'month';

interface DateRangeSelectorProps {
  selected: DatePreset;
  onSelect: (preset: DatePreset) => void;
}

function localDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDateRange(preset: DatePreset): {
  start: string;
  end: string;
} {
  const now = new Date();
  const end = localDateString(now);

  switch (preset) {
    case 'today':
      return { start: end, end };
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: localDateString(weekAgo), end };
    }
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: localDateString(monthAgo), end };
    }
  }
}

export default function DateRangeSelector({
  selected,
  onSelect,
}: DateRangeSelectorProps) {
  const { t } = useT();

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

const styles = StyleSheet.create({
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
    color: colors.background,
  },
});
