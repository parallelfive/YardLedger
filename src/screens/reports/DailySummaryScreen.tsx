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
import SummaryCards from '../../components/SummaryCards';
import {
  fetchDailySummary,
  fetchRecentBuyTotals,
  type DailySummary,
} from '../../services/reports';
import { Sparkline, SectionLabel, fmtMoney0 } from '../../components/foundry';
import { ResponsiveContainer, ReportError } from '../../components';
import { useT } from '../../hooks/useT';
import { useCompanyTimezone } from '../../hooks/useCompanyTimezone';
import { type Palette, spacing, fonts } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

export default function DailySummaryScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const isFocused = useIsFocused();
  const tz = useCompanyTimezone();
  const [preset, setPreset] = useState<DatePreset>('today');
  const [data, setData] = useState<DailySummary | null>(null);
  const [trend, setTrend] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { start, end } = getDateRange(preset, tz);
      const [summary, recent] = await Promise.all([
        fetchDailySummary(start, end),
        fetchRecentBuyTotals(14),
      ]);
      setData(summary);
      setTrend(recent);
    } catch {
      setError(true); // surface the failure instead of a misleading empty state
    } finally {
      setLoading(false);
    }
  }, [preset, tz]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [loadData, isFocused]);

  const trendTotal = trend.reduce((sum, n) => sum + n, 0);

  return (
    <ScrollView style={styles.container}>
      <ResponsiveContainer maxWidth={640}>
        <DateRangeSelector selected={preset} onSelect={setPreset} />

        {loading ? (
          <ActivityIndicator
            color={colors.accent}
            size="large"
            style={styles.loader}
          />
        ) : error && !data ? (
          <ReportError onRetry={loadData} />
        ) : data ? (
          <>
            {trend.length > 0 && (
              <View style={styles.trendCard}>
                <SectionLabel>{t.intakeTrend}</SectionLabel>
                <Text style={styles.trendValue}>{fmtMoney0(trendTotal)}</Text>
                <Text style={styles.trendSub}>{t.totalLast14}</Text>
                <Sparkline data={trend} height={56} color={colors.accent} />
              </View>
            )}
            <SummaryCards data={data} />
          </>
        ) : null}
      </ResponsiveContainer>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loader: {
      marginTop: spacing.xxxl,
    },
    trendCard: {
      backgroundColor: colors.card,
      marginHorizontal: spacing.lg,
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    trendValue: {
      color: colors.textPrimary,
      fontSize: 30,
      fontFamily: fonts.monoSemiBold,
      marginTop: spacing.xs,
    },
    trendSub: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: fonts.mono,
      marginBottom: spacing.md,
    },
  });
