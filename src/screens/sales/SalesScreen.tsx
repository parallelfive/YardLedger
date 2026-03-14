import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from '../../navigation/MainNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '../../hooks/useT';
import { useSales } from '../../hooks/useSales';
import { RefreshableList, DateRangeSelector } from '../../components';
import {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import { colors, spacing, fontSize, borderRadius } from '../../constants';
import { calculateTotalProfit } from '../../utils/calculations';
import { aggregateSalesByCategory } from '../../services/sales';

type Props = NativeStackScreenProps<SalesStackParamList, 'SalesList'>;

export default function SalesScreen({ navigation }: Props) {
  const { t } = useT();
  const [preset, setPreset] = useState<DatePreset>('today');
  const { start, end } = getDateRange(preset);
  const { sales, loading, refresh } = useSales(start, end);
  const totalProfit = calculateTotalProfit(sales);
  const categorySummaries = aggregateSalesByCategory(sales);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={styles.container}>
      <DateRangeSelector selected={preset} onSelect={setPreset} />
      {sales.length > 0 && (
        <>
          <View style={styles.summaryBar}>
            <Text style={styles.summaryLabel}>{t.totalProfit}</Text>
            <Text
              style={[
                styles.summaryValue,
                totalProfit < 0 && styles.summaryNegative,
              ]}
            >
              ${totalProfit.toFixed(2)}
            </Text>
          </View>

          {categorySummaries.length > 0 && (
            <View style={styles.categorySection}>
              <Text style={styles.categorySectionTitle}>
                {t.profitByCategory}
              </Text>
              {categorySummaries.map((cat) => (
                <View key={cat.categoryName} style={styles.categoryCard}>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{cat.categoryName}</Text>
                    <Text
                      style={[
                        styles.categoryProfit,
                        cat.totalProfit < 0 && styles.categoryProfitNegative,
                      ]}
                    >
                      ${cat.totalProfit.toFixed(2)}
                    </Text>
                  </View>
                  <View style={styles.categoryDetails}>
                    <Text style={styles.categoryDetail}>
                      {t.sold}: {cat.totalWeightSold.toFixed(0)} lbs
                    </Text>
                    <Text style={styles.categoryDetail}>
                      {t.revenue}: ${cat.totalRevenue.toFixed(2)}
                    </Text>
                    <Text style={styles.categoryDetail}>
                      {t.cost}: ${cat.totalCost.toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
      <RefreshableList
        data={sales}
        keyExtractor={(item) => item.id}
        loading={loading}
        onRefresh={refresh}
        emptyTitle={t.noSales}
        emptySubtitle={t.recordSalesProfit}
        renderItem={({ item }) => {
          const profit = Number(item.profit);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.metalName}>{item.metal_name}</Text>
                <Text
                  style={[styles.profit, profit < 0 && styles.profitNegative]}
                >
                  ${profit.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.detail}>
                {Number(item.weight).toFixed(2)} lbs @ $
                {Number(item.sale_price_per_lb).toFixed(4)}
                {t.perLb}
              </Text>
              <Text style={styles.detail}>
                {t.revenue}: ${Number(item.total_revenue).toFixed(2)} |{' '}
                {t.avgCost}: ${Number(item.cost_basis_per_lb).toFixed(4)}
                {t.perLb}
              </Text>
              {item.buyer_name ? (
                <Text style={styles.detail}>
                  {t.buyerName}: {item.buyer_name}
                </Text>
              ) : null}
              <Text style={styles.date}>
                {new Date(item.created_at).toLocaleDateString()}
              </Text>
            </View>
          );
        }}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewSale')}
      >
        <Text style={styles.fabText}>{t.newSale}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  summaryLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
  },
  summaryValue: {
    color: colors.success,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  summaryNegative: {
    color: colors.danger,
  },
  categorySection: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  categorySectionTitle: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  categoryProfit: {
    color: colors.success,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  categoryProfitNegative: {
    color: colors.danger,
  },
  categoryDetails: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  categoryDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  profit: {
    color: colors.success,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  profitNegative: {
    color: colors.danger,
  },
  detail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  date: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    elevation: 5,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  fabText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
});
