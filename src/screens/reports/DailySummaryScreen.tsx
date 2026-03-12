import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import DateRangeSelector, {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import { fetchDailySummary, type DailySummary } from '../../services/reports';
import { useT } from '../../hooks/useT';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

export default function DailySummaryScreen() {
  const { t } = useT();
  const isFocused = useIsFocused();
  const [preset, setPreset] = useState<DatePreset>('today');
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(preset);
      const summary = await fetchDailySummary(start, end);
      setData(summary);
    } catch {
      // Will show empty
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [loadData, isFocused]);

  return (
    <ScrollView style={styles.container}>
      <DateRangeSelector selected={preset} onSelect={setPreset} />

      {loading ? (
        <ActivityIndicator
          color={colors.accent}
          size="large"
          style={styles.loader}
        />
      ) : data ? (
        <>
          <View style={styles.row}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t.totalBought}</Text>
              <Text style={styles.statValue}>
                ${data.totalBoughtDollars.toFixed(2)}
              </Text>
              <Text style={styles.statSub}>
                {data.totalBoughtWeight.toFixed(0)} lbs
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t.totalSold}</Text>
              <Text style={styles.statValue}>
                ${data.totalSoldRevenue.toFixed(2)}
              </Text>
              <Text style={styles.statSub}>
                {data.totalSoldWeight.toFixed(0)} lbs
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t.grossProfit}</Text>
              <Text
                style={[
                  styles.statValue,
                  {
                    color:
                      data.grossProfit >= 0 ? colors.success : colors.danger,
                  },
                ]}
              >
                ${data.grossProfit.toFixed(2)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>{t.receipts}</Text>
              <Text style={styles.statValue}>{data.receiptCount}</Text>
            </View>
          </View>

          {data.topMetals.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t.topMetalsBought}</Text>
              {data.topMetals.map((metal) => (
                <View key={metal.name} style={styles.metalRow}>
                  <Text style={styles.metalName}>{metal.name}</Text>
                  <Text style={styles.metalWeight}>
                    {metal.weight.toFixed(0)} lbs
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.accent,
    fontSize: fontSize.xxl,
    fontWeight: 'bold',
  },
  statSub: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
    marginBottom: spacing.md,
  },
  metalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  metalWeight: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
  },
});
