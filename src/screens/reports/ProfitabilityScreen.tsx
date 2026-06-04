import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateRangeSelector, {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import {
  fetchProfitabilityReport,
  type ProfitabilityReport,
  type ProfitabilityRow,
} from '../../services/reports';
import { useT } from '../../hooks/useT';
import {
  SectionLabel,
  MetalDot,
  DeltaTag,
  MiniStat,
  fmtMoney,
  fmtMoney0,
  fmtLbs,
  toneColor,
  type Tone,
} from '../../components/foundry';
import { colors, spacing, fontSize, fonts } from '../../constants';

function toneFor(category: string | undefined): Tone {
  switch (category) {
    case 'Copper':
      return 'copper';
    case 'Brass':
      return 'gold';
    case 'Aluminum':
    case 'Steel':
      return 'steel';
    default:
      return 'ink3';
  }
}

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

  const profitUp = data.overallProfit >= 0;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={data.rows}
      keyExtractor={(item) => item.metalName}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadData}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={
        <>
          <DateRangeSelector selected={preset} onSelect={setPreset} />

          {/* Profit hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>{t.profit}</Text>
            <Text
              style={[
                styles.heroValue,
                { color: profitUp ? colors.moss : colors.rust },
              ]}
            >
              {fmtMoney0(data.overallProfit)}
            </Text>
            <View style={styles.heroSubRow}>
              <Text style={styles.heroSub}>
                {fmtMoney0(data.overallRevenue)} {t.revenue.toLowerCase()}
              </Text>
              <DeltaTag up={data.overallMargin >= 0}>
                {`${data.overallMargin.toFixed(1)}% ${t.margin.toLowerCase()}`}
              </DeltaTag>
            </View>
          </View>

          {/* Revenue / cost mini-stats */}
          <View style={styles.statRow}>
            <MiniStat
              label={t.revenue}
              value={fmtMoney0(data.overallRevenue)}
              tone="steel"
              icon="trending-up-outline"
            />
            <MiniStat
              label={t.cost}
              value={fmtMoney0(data.overallCost)}
              tone="gold"
              icon="cube-outline"
            />
          </View>

          <SectionLabel>{t.profitByCategory}</SectionLabel>
        </>
      }
      renderItem={({ item }: { item: ProfitabilityRow }) => {
        const up = item.totalProfit >= 0;
        const tone = toneFor(item.categoryName);
        return (
          <View
            style={[styles.metalCard, { borderLeftColor: toneColor(tone) }]}
          >
            <View style={styles.metalHeader}>
              <View style={styles.metalTitleLine}>
                <MetalDot tone={tone} />
                <View style={styles.flex}>
                  <Text style={styles.metalName}>{item.metalName}</Text>
                  <Text style={styles.metalCategory}>{item.categoryName}</Text>
                </View>
              </View>
              <View style={styles.metalRight}>
                <Text
                  style={[
                    styles.metalProfit,
                    { color: up ? colors.moss : colors.rust },
                  ]}
                >
                  {fmtMoney(item.totalProfit)}
                </Text>
                <DeltaTag up={item.marginPercent >= 0}>
                  {`${item.marginPercent.toFixed(1)}%`}
                </DeltaTag>
              </View>
            </View>
            <View style={styles.metalStats}>
              <View style={styles.metalStat}>
                <Text style={styles.metalStatLabel}>{t.bought}</Text>
                <Text style={styles.metalStatValue}>
                  {fmtMoney(item.totalBoughtCost)}
                </Text>
                <Text style={styles.metalStatSub}>
                  {fmtLbs(item.weightBought)} lb
                </Text>
              </View>
              <View style={styles.metalStatDivider} />
              <View style={styles.metalStat}>
                <Text style={styles.metalStatLabel}>{t.sold}</Text>
                <Text style={styles.metalStatValue}>
                  {fmtMoney(item.totalRevenue)}
                </Text>
                <Text style={styles.metalStatSub}>
                  {fmtLbs(item.weightSold)} lb
                </Text>
              </View>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons
            name="bar-chart-outline"
            size={40}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>{t.noDataForRange}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  loader: { marginTop: spacing.xxxl },
  hero: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  heroEyebrow: {
    color: colors.textTertiary,
    fontSize: 11.5,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroValue: {
    fontSize: 40,
    fontFamily: fonts.display,
    letterSpacing: -1,
    marginTop: 5,
  },
  heroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  heroSub: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fonts.mono,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  metalCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
  },
  metalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  metalTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
  },
  metalCategory: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.mono,
    marginTop: 1,
  },
  metalRight: { alignItems: 'flex-end', gap: 3 },
  metalProfit: {
    fontSize: 17,
    fontFamily: fonts.display,
    letterSpacing: -0.3,
  },
  metalStats: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    paddingVertical: spacing.sm,
  },
  metalStat: { flex: 1, alignItems: 'center', gap: 2 },
  metalStatDivider: { width: 1, backgroundColor: colors.borderSubtle },
  metalStatLabel: {
    color: colors.textTertiary,
    fontSize: 9.5,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  metalStatValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.monoSemiBold,
  },
  metalStatSub: {
    color: colors.textTertiary,
    fontSize: 10.5,
    fontFamily: fonts.mono,
  },
  empty: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
  },
});
