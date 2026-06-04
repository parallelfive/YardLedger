import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchInventoryValuation,
  type InventoryValuationReport,
} from '../../services/reports';
import { useT } from '../../hooks/useT';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

export default function InventoryValuationScreen() {
  const { t } = useT();
  const [data, setData] = useState<InventoryValuationReport | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchInventoryValuation());
    } catch {
      // Will show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  if (loading) {
    return (
      <View style={styles.container}>
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
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.costValue}</Text>
            <Text style={styles.summaryValue}>
              ${data.totalCostValue.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.marketValue}</Text>
            <Text style={styles.summaryValue}>
              ${data.totalMarketValue.toFixed(2)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{t.unrealized}</Text>
            <Text
              style={[
                styles.summaryValue,
                {
                  color:
                    data.totalUnrealized >= 0 ? colors.success : colors.danger,
                },
              ]}
            >
              ${data.totalUnrealized.toFixed(2)}
            </Text>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.metalCard}>
          <View style={styles.metalHeader}>
            <View>
              <Text style={styles.metalName}>{item.metalName}</Text>
              <Text style={styles.metalCategory}>{item.categoryName}</Text>
            </View>
            <Text style={styles.metalWeight}>{item.weight.toFixed(0)} lbs</Text>
          </View>
          <View style={styles.metalDetails}>
            <Text style={styles.detailText}>
              {t.cost}: ${item.costValue.toFixed(2)} (${item.avgCost.toFixed(4)}
              {t.perLb})
            </Text>
            <Text style={styles.detailText}>
              {t.marketValue}: ${item.marketValue.toFixed(2)} ($
              {item.marketPrice.toFixed(4)}
              {t.perLb})
            </Text>
            <Text
              style={[
                styles.detailText,
                {
                  color:
                    item.unrealizedGainLoss >= 0
                      ? colors.success
                      : colors.danger,
                },
              ]}
            >
              {t.unrealized}: ${item.unrealizedGainLoss.toFixed(2)}
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
    padding: spacing.lg,
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
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
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
  metalWeight: {
    color: colors.accent,
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
