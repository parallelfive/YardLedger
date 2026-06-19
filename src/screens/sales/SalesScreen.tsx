import { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from '../../navigation/MainNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { useSales } from '../../hooks/useSales';
import { useRefreshOnReconnect } from '../../hooks/useRefreshOnReconnect';
import { DateRangeSelector } from '../../components';
import {
  SectionLabel,
  DeltaTag,
  fmtMoney,
  fmtMoney0,
  fmtLbs,
} from '../../components/foundry';
import { TareHeader } from '../../components';
import {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

type Props = NativeStackScreenProps<SalesStackParamList, 'SalesList'>;

export default function SalesScreen({ navigation }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [preset, setPreset] = useState<DatePreset>('month');
  const { start, end } = getDateRange(preset);
  const { sales, loading, error, refresh } = useSales(start, end);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  useRefreshOnReconnect(refresh);

  const { revenue, profit, weight } = useMemo(() => {
    return sales.reduce(
      (acc, s) => ({
        revenue: acc.revenue + Number(s.total_revenue),
        profit: acc.profit + Number(s.profit),
        weight: acc.weight + Number(s.weight),
      }),
      { revenue: 0, profit: 0, weight: 0 }
    );
  }, [sales]);

  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  return (
    <View style={styles.container}>
      <TareHeader title={t.tabSales} rightLabel={t.outbound} />
      <FlatList
        data={sales}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <DateRangeSelector selected={preset} onSelect={setPreset} />
            {error ? (
              <View style={styles.errorBar}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.statRow}>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t.totalSold}</Text>
                <Text style={styles.statValue}>{fmtMoney0(revenue)}</Text>
                <Text style={styles.statSub}>
                  {fmtLbs(weight)} {t.lbShipped}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statLabel}>{t.grossProfit}</Text>
                <Text
                  style={[
                    styles.statValue,
                    { color: profit < 0 ? colors.rust : colors.moss },
                  ]}
                >
                  {fmtMoney0(profit)}
                </Text>
                <Text style={styles.statSub}>
                  {margin}% {t.margin.toLowerCase()}
                </Text>
              </View>
            </View>

            <SectionLabel
              actionLabel={t.newSaleAction}
              onAction={() => navigation.navigate('NewSale')}
            >
              {t.outboundLoads}
            </SectionLabel>
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons
                name="trending-up-outline"
                size={40}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>{t.noSales}</Text>
              <Text style={styles.emptySub}>{t.recordSalesProfit}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const p = Number(item.profit);
          const date = new Date(item.created_at).toLocaleDateString();
          return (
            <View style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="cube-outline" size={20} color={colors.teal} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowBuyer} numberOfLines={1}>
                  {item.buyer_name || item.metal_name}
                </Text>
                <Text style={styles.rowMeta}>
                  {item.metal_name} · {fmtLbs(Number(item.weight))} lb · {date}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowTotal}>
                  {fmtMoney(Number(item.total_revenue))}
                </Text>
                <DeltaTag up={p >= 0}>{fmtMoney(Math.abs(p))}</DeltaTag>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
      gap: spacing.sm,
    },
    statRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginVertical: spacing.md,
    },
    statCard: {
      flex: 1,
      padding: spacing.lg,
      borderRadius: 18,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: 24,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
      marginTop: 4,
    },
    statSub: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
      marginTop: 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    rowIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.teal + '24',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowInfo: { flex: 1 },
    rowBuyer: {
      color: colors.textPrimary,
      fontSize: 14.5,
      fontFamily: fonts.sansSemiBold,
    },
    rowMeta: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
      marginTop: 2,
    },
    rowRight: { alignItems: 'flex-end', gap: 3 },
    rowTotal: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fonts.monoSemiBold,
    },
    errorBar: {
      backgroundColor: colors.danger,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginTop: spacing.md,
    },
    errorText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
    },
    empty: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansSemiBold,
    },
    emptySub: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: fonts.sans,
      textAlign: 'center',
    },
  });
