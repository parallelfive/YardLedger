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
  fetchShrinkageReport,
  type ShrinkageRow,
} from '../../services/reports';
import { useT } from '../../hooks/useT';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

export default function ShrinkageScreen() {
  const { t } = useT();
  const [data, setData] = useState<ShrinkageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchShrinkageReport());
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

  return (
    <FlatList
      style={styles.container}
      data={data}
      keyExtractor={(item) => item.metalName}
      ListHeaderComponent={
        <Text style={styles.headerNote}>{t.shrinkageNote}</Text>
      }
      renderItem={({ item }) => {
        const isNegative = item.discrepancy < 0;
        const severity =
          Math.abs(item.discrepancyPercent) > 5
            ? colors.danger
            : Math.abs(item.discrepancyPercent) > 2
              ? colors.warning
              : colors.success;

        return (
          <View style={[styles.card, { borderLeftColor: severity }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.metalName}>{item.metalName}</Text>
                <Text style={styles.metalCategory}>{item.categoryName}</Text>
              </View>
              <View style={styles.discrepancyBadge}>
                <Text style={[styles.discrepancyValue, { color: severity }]}>
                  {isNegative ? '' : '+'}
                  {item.discrepancy.toFixed(0)} lbs
                </Text>
                <Text style={[styles.discrepancyPercent, { color: severity }]}>
                  ({item.discrepancyPercent.toFixed(1)}%)
                </Text>
              </View>
            </View>
            <View style={styles.details}>
              <Text style={styles.detailText}>
                {t.bought}: {item.totalBought.toFixed(0)} lbs
              </Text>
              <Text style={styles.detailText}>
                {t.sold}: {item.totalSold.toFixed(0)} lbs
              </Text>
              <Text style={styles.detailText}>
                {t.expected}: {item.expectedInventory.toFixed(0)} lbs
              </Text>
              <Text style={styles.detailText}>
                {t.actual}: {item.actualInventory.toFixed(0)} lbs
              </Text>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <Text style={styles.emptyText}>{t.noShrinkageData}</Text>
      }
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
  headerNote: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  metalCategory: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
  discrepancyBadge: {
    alignItems: 'flex-end',
  },
  discrepancyValue: {
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  discrepancyPercent: {
    fontSize: fontSize.sm,
  },
  details: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    textAlign: 'center',
    marginTop: spacing.xxxl,
  },
});
