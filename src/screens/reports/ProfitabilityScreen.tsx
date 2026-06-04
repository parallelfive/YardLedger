import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import DateRangeSelector, {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import {
  fetchProfitabilityReport,
  type ProfitabilityReport,
} from '../../services/reports';
import { useT } from '../../hooks/useT';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

export default function ProfitabilityScreen() {
  const { t } = useT();
  const isFocused = useIsFocused();
  const [preset, setPreset] = useState<DatePreset>('month');
  const [data, setData] = useState<ProfitabilityReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(preset);
      setData(await fetchProfitabilityReport(start, end));
    } catch {
      // Will show empty
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [loadData, isFocused]);

  if (loading) {
    return (
      <View style={styles.container}>
        <DateRangeSelector selected={preset} onSelect={setPreset} />
        <ActivityIndicator
          color={colors.accent}
          size="large"
          style={styles.loader}
        />
      </View>
    );
  }

  if (!data) return null;

  return (
    <FlatList
      style={styles.container}
      data={data.rows}
      keyExtractor={(item) => item.metalName}
      ListHeaderComponent={
        <>
          <DateRangeSelector selected={preset} onSelect={setPreset} />
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t.revenue}</Text>
              <Text style={styles.summaryValue}>
                ${data.overallRevenue.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t.cost}</Text>
              <Text style={styles.summaryValue}>
                ${data.overallCost.toFixed(2)}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t.profit}</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      data.overallProfit >= 0 ? colors.success : colors.danger,
                  },
                ]}
              >
                ${data.overallProfit.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>{t.margin}</Text>
              <Text
                style={[
                  styles.summaryValue,
                  {
                    color:
                      data.overallMargin >= 0 ? colors.success : colors.danger,
                  },
                ]}
              >
                {data.overallMargin.toFixed(1)}%
              </Text>
            </View>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.metalCard}>
          <View style={styles.metalHeader}>
            <View>
              <Text style={styles.metalName}>{item.metalName}</Text>
              <Text style={styles.metalCategory}>{item.categoryName}</Text>
            </View>
            <Text
              style={[
                styles.metalProfit,
                {
                  color: item.totalProfit >= 0 ? colors.success : colors.danger,
                },
              ]}
            >
              ${item.totalProfit.toFixed(2)}
            </Text>
          </View>
          <View style={styles.metalDetails}>
            <Text style={styles.detailText}>
              {t.bought}: {item.weightBought.toFixed(0)} lbs — $
              {item.totalBoughtCost.toFixed(2)}
            </Text>
            <Text style={styles.detailText}>
              {t.sold}: {item.weightSold.toFixed(0)} lbs — $
              {item.totalRevenue.toFixed(2)}
            </Text>
            <Text
              style={[
                styles.detailText,
                {
                  color:
                    item.marginPercent >= 0 ? colors.success : colors.danger,
                },
              ]}
            >
              {t.margin}: {item.marginPercent.toFixed(1)}%
            </Text>
          </View>
        </View>
      )}
      refreshing={loading}
      onRefresh={loadData}
    />
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
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    fontFamily: fonts.sans,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fonts.monoSemiBold,
  },
  metalCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  metalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  metalCategory: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
  metalProfit: {
    fontSize: fontSize.lg,
    fontFamily: fonts.monoSemiBold,
  },
  metalDetails: {
    gap: spacing.xs,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
});
