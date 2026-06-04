import { View, Text, StyleSheet } from 'react-native';
import type { DailySummary } from '../services/reports';
import { useT } from '../hooks/useT';
import { colors, spacing, fontSize, borderRadius, fonts } from '../constants';

interface SummaryCardsProps {
  data: DailySummary;
}

export default function SummaryCards({ data }: SummaryCardsProps) {
  const { t } = useT();

  return (
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
                color: data.grossProfit >= 0 ? colors.success : colors.danger,
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
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.sansSemiBold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  statValue: {
    color: colors.accent,
    fontSize: fontSize.xxl,
    fontFamily: fonts.monoSemiBold,
  },
  statSub: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fonts.mono,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
    marginBottom: spacing.md,
  },
  metalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansMedium,
  },
  metalWeight: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    fontFamily: fonts.mono,
  },
});
