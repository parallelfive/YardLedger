import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchInventoryValuation,
  type InventoryValuationReport,
  type InventoryValuationRow,
} from '../../services/reports';
import { useT } from '../../hooks/useT';
import { useResponsive } from '../../hooks';
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
import { type Palette, spacing, fontSize, fonts } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

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

export default function InventoryValuationScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { isWide } = useResponsive();
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

  const gainUp = data.totalUnrealized >= 0;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        isWide && { maxWidth: 640, alignSelf: 'center', width: '100%' },
      ]}
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
          {/* Market-value hero */}
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>{t.marketValue}</Text>
            <Text style={styles.heroValue}>
              {fmtMoney0(data.totalMarketValue)}
            </Text>
            <View style={styles.heroSubRow}>
              <Text style={styles.heroSub}>
                {t.costValue} {fmtMoney0(data.totalCostValue)}
              </Text>
              <DeltaTag up={gainUp}>
                {fmtMoney0(Math.abs(data.totalUnrealized))}
              </DeltaTag>
            </View>
          </View>

          {/* Cost / unrealized mini-stats */}
          <View style={styles.statRow}>
            <MiniStat
              label={t.costValue}
              value={fmtMoney0(data.totalCostValue)}
              sub={`${data.rows.length} ${t.metalsWord}`}
              tone="steel"
              icon="cube-outline"
            />
            <MiniStat
              label={t.unrealized}
              value={fmtMoney0(data.totalUnrealized)}
              sub={gainUp ? t.unrealizedGain : t.unrealizedLoss}
              tone={gainUp ? 'moss' : 'rust'}
              icon={gainUp ? 'trending-up-outline' : 'trending-down-outline'}
            />
          </View>

          <SectionLabel>{t.inventoryValuation}</SectionLabel>
        </>
      }
      renderItem={({ item }: { item: InventoryValuationRow }) => {
        const up = item.unrealizedGainLoss >= 0;
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
                <Text style={styles.metalWeight}>
                  {fmtLbs(item.weight)}
                  <Text style={styles.metalWeightUnit}> lb</Text>
                </Text>
                <DeltaTag up={up}>
                  {fmtMoney(Math.abs(item.unrealizedGainLoss))}
                </DeltaTag>
              </View>
            </View>
            <View style={styles.metalStats}>
              <View style={styles.metalStat}>
                <Text style={styles.metalStatLabel}>{t.cost}</Text>
                <Text style={styles.metalStatValue}>
                  {fmtMoney(item.costValue)}
                </Text>
                <Text style={styles.metalStatSub}>
                  {fmtMoney(item.avgCost, 4)}
                  {t.perLb}
                </Text>
              </View>
              <View style={styles.metalStatDivider} />
              <View style={styles.metalStat}>
                <Text style={styles.metalStatLabel}>{t.marketValue}</Text>
                <Text style={styles.metalStatValue}>
                  {fmtMoney(item.marketValue)}
                </Text>
                <Text style={styles.metalStatSub}>
                  {fmtMoney(item.marketPrice, 4)}
                  {t.perLb}
                </Text>
              </View>
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyText}>{t.noInventory}</Text>
        </View>
      }
    />
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
      gap: spacing.sm,
    },
    loader: { marginTop: spacing.xxxl },
    hero: {
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
      color: colors.textPrimary,
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
      marginBottom: spacing.md,
    },
    metalCard: {
      backgroundColor: colors.card,
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
    metalWeight: {
      color: colors.textPrimary,
      fontSize: 17,
      fontFamily: fonts.display,
      letterSpacing: -0.3,
    },
    metalWeightUnit: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
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
