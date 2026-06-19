import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRefreshOnReconnect } from '../../hooks/useRefreshOnReconnect';
import { Ionicons } from '@expo/vector-icons';
import { TareHeader } from '../../components';
import {
  fetchDailySummary,
  fetchInventoryValuation,
  fetchRecentBuyTotals,
  fetchUnreportedReceipts,
  type DailySummary,
} from '../../services/reports';
import { fetchReceipts } from '../../services/receipts';
import { getDateRange } from '../../components/DateRangeSelector';
import {
  MiniStat,
  MetalMixBar,
  SectionLabel,
  TicketRow,
  Sparkline,
  DeltaTag,
  fmtMoney,
  fmtMoney0,
  fmtLbs,
  type Tone,
} from '../../components/foundry';
import { useT } from '../../hooks/useT';
import { useRole } from '../../hooks';
import { type Palette, spacing, borderRadius, fonts } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

type Nav = { navigate: (s: string, p?: Record<string, unknown>) => void };

interface MixRow {
  name: string;
  pct: number;
  tone: Tone;
}
interface Ticket {
  id: string;
  customer: string;
  meta: string;
  total: string;
  sub: string;
  restricted: boolean;
}

const MIX_TONES: Tone[] = ['copper', 'steel', 'gold', 'moss', 'ink3'];

export default function DashboardScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const { isAdmin } = useRole();
  const styles = useThemedStyles(makeStyles);
  const navigation = useNavigation() as unknown as Nav;
  const today = new Date();
  const dateStr = `${today.toLocaleDateString('en-US', { weekday: 'short' })} · ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [spark, setSpark] = useState<number[]>([]);
  const [onHand, setOnHand] = useState({ value: 0, count: 0 });
  const [mix, setMix] = useState<MixRow[]>([]);
  const [unreported, setUnreported] = useState(0);
  const [recent, setRecent] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange('today');
      const [s, val, sp, unrep, receipts] = await Promise.all([
        fetchDailySummary(start, end),
        fetchInventoryValuation(),
        fetchRecentBuyTotals(14),
        fetchUnreportedReceipts(),
        fetchReceipts(),
      ]);
      setSummary(s);
      setSpark(sp);
      setOnHand({ value: val.totalCostValue, count: val.rows.length });
      setUnreported(unrep.length);

      const totalWeight = val.rows.reduce((a, r) => a + r.weight, 0) || 1;
      setMix(
        [...val.rows]
          .sort((a, b) => b.weight - a.weight)
          .slice(0, 5)
          .map((r, i) => ({
            name: r.metalName,
            pct: r.weight / totalWeight,
            tone: MIX_TONES[i] ?? 'ink3',
          }))
      );

      setRecent(
        (receipts ?? []).slice(0, 4).map((r) => {
          const items = (r.line_items ?? []) as {
            weight: number;
            is_restricted?: boolean;
          }[];
          const wt = items.reduce((a, li) => a + Number(li.weight), 0);
          const time = new Date(r.created_at).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          });
          const no = String(r.receipt_number).split('-').slice(-1)[0];
          return {
            id: r.id,
            customer: r.customer_name,
            meta: `#${no} · ${time}`,
            total: fmtMoney(Number(r.subtotal)),
            sub: `${fmtLbs(wt)} lb · ${items.length} item${items.length === 1 ? '' : 's'}`,
            restricted: items.some((li) => li.is_restricted),
          };
        })
      );
    } catch {
      // Will show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );
  useRefreshOnReconnect(load);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const bought = summary?.totalBoughtDollars ?? 0;
  // Derive dollars + cents from a single rounded value so they can't disagree
  // at the .995 boundary (e.g. 1234.999 → "$1,234" + ".100").
  const boughtCents = Math.round(bought * 100);
  const boughtWhole = Math.floor(boughtCents / 100);
  const cents = String(boughtCents % 100).padStart(2, '0');
  const margin =
    summary && summary.totalSoldRevenue > 0
      ? Math.round((summary.grossProfit / summary.totalSoldRevenue) * 100)
      : 0;

  // Delta vs the trailing 14-day average (matches the design's "% vs avg").
  const trailing = spark.slice(0, -1);
  const avg = trailing.length
    ? trailing.reduce((a, n) => a + n, 0) / trailing.length
    : 0;
  const last = spark.length ? spark[spark.length - 1] : 0;
  const deltaPct = avg > 0 ? Math.round(((last - avg) / avg) * 100) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TareHeader title={t.dayBook} rightLabel={dateStr} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        {/* Hero — bought today */}
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <Text style={styles.eyebrow}>{t.boughtToday}</Text>
            {deltaPct !== 0 ? (
              <DeltaTag up={deltaPct > 0}>
                {`${Math.abs(deltaPct)}% ${t.vsAvg}`}
              </DeltaTag>
            ) : null}
          </View>
          <Text style={styles.heroValue}>
            {fmtMoney0(boughtWhole)}
            <Text style={styles.heroCents}>.{cents}</Text>
          </Text>
          <Text style={styles.heroSub}>
            {fmtLbs(summary?.totalBoughtWeight ?? 0)} lb ·{' '}
            {summary?.receiptCount ?? 0} {t.receipts.toLowerCase()}
          </Text>
          <View style={{ marginTop: 14 }}>
            <Sparkline data={spark} />
          </View>
        </View>

        {/* Mini stats */}
        <View style={styles.statRow}>
          <MiniStat
            label={t.soldToday}
            value={fmtMoney0(summary?.totalSoldRevenue ?? 0)}
            sub={`${fmtLbs(summary?.totalSoldWeight ?? 0)} ${t.lbOut}`}
            tone="steel"
            icon="cube-outline"
          />
          <MiniStat
            label={t.grossProfit}
            value={fmtMoney0(summary?.grossProfit ?? 0)}
            sub={`${margin}% ${t.margin.toLowerCase()}`}
            tone="moss"
            icon="trending-up-outline"
          />
          <MiniStat
            label={t.onHandValue}
            value={fmtMoney0(onHand.value)}
            sub={`${onHand.count} ${t.metals}`}
            tone="copper"
            icon="layers-outline"
          />
        </View>

        {/* Compliance strip — only managers can reach the Reports tab it links to */}
        {isAdmin && unreported > 0 && (
          <TouchableOpacity
            style={styles.compliance}
            activeOpacity={0.7}
            onPress={() =>
              navigation.navigate('ReportsTab', { screen: 'ComplianceReport' })
            }
          >
            <View style={styles.complianceIcon}>
              <Ionicons name="shield-outline" size={19} color={colors.rust} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.complianceTitle}>
                {unreported} {t.awaitingReport}
              </Text>
              <Text style={styles.complianceSub}>{t.recycledMetalsAct}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.rust} />
          </TouchableOpacity>
        )}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.action, styles.actionPrimary]}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('TransactionsTab', {
                screen: 'NewTransaction',
              })
            }
          >
            <Ionicons name="add" size={22} color={colors.accentInk} />
            <Text style={[styles.actionLabel, { color: colors.accentInk }]}>
              {t.newBuy}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.85}
            onPress={() =>
              navigation.navigate('SalesTab', { screen: 'NewSale' })
            }
          >
            <Ionicons name="cube-outline" size={22} color={colors.teal} />
            <Text style={styles.actionLabel}>{t.newSale}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.action}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Inventory')}
          >
            <Ionicons
              name="layers-outline"
              size={22}
              color={colors.textSecondary}
            />
            <Text style={styles.actionLabel}>{t.stock}</Text>
          </TouchableOpacity>
        </View>

        {/* Metal mix */}
        {mix.length > 0 && (
          <View style={styles.mixCard}>
            <View style={styles.mixHead}>
              <Text style={styles.mixTitle}>{t.metalMix}</Text>
              <Text style={styles.mixSub}>{t.onHandByWeight}</Text>
            </View>
            <MetalMixBar data={mix} />
          </View>
        )}

        {/* Recent intake */}
        {recent.length > 0 && (
          <>
            <SectionLabel
              actionLabel={t.viewAll}
              onAction={() => navigation.navigate('TransactionsTab')}
            >
              {t.recentIntake}
            </SectionLabel>
            <View style={styles.ticketList}>
              {recent.map((r) => (
                <TicketRow
                  key={r.id}
                  customer={r.customer}
                  meta={r.meta}
                  total={r.total}
                  sub={r.sub}
                  restricted={r.restricted}
                  onPress={() =>
                    navigation.navigate('TransactionsTab', {
                      screen: 'ReceiptDetail',
                      params: { receiptId: r.id },
                    })
                  }
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingTop: spacing.md, paddingBottom: spacing.xxxl },
    tareHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    companyChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      maxWidth: 150,
      paddingVertical: 6,
      paddingLeft: 7,
      paddingRight: 11,
      borderRadius: 99,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.border,
    },
    companyAvatar: {
      width: 22,
      height: 22,
      borderRadius: 7,
      backgroundColor: colors.textPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companyAvatarText: {
      color: colors.background,
      fontSize: 10,
      fontFamily: fonts.display,
    },
    companyName: {
      flexShrink: 1,
      fontSize: 12.5,
      fontFamily: fonts.sansSemiBold,
      color: colors.textSecondary,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dayBookRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    dayBook: {
      fontSize: 30,
      fontFamily: fonts.display,
      letterSpacing: -0.8,
      color: colors.textPrimary,
    },
    dayBookDate: {
      fontSize: 11.5,
      fontFamily: fonts.mono,
      color: colors.textTertiary,
      paddingBottom: 5,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    hero: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      padding: spacing.xl,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    heroHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      fontFamily: fonts.mono,
      fontSize: 11.5,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    heroValue: {
      fontFamily: fonts.display,
      fontSize: 46,
      lineHeight: 48,
      letterSpacing: -1,
      color: colors.textPrimary,
      marginTop: 6,
    },
    heroCents: {
      fontFamily: fonts.mono,
      fontSize: 22,
      color: colors.textTertiary,
    },
    heroSub: {
      fontFamily: fonts.mono,
      fontSize: 12.5,
      color: colors.textSecondary,
      marginTop: 3,
    },
    statRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
    },
    compliance: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 13,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      padding: 14,
      borderRadius: borderRadius.lg,
      backgroundColor: 'rgba(181, 70, 47, 0.10)',
      borderWidth: 1,
      borderColor: 'rgba(181, 70, 47, 0.30)',
    },
    complianceIcon: {
      width: 34,
      height: 34,
      borderRadius: 9,
      backgroundColor: 'rgba(181, 70, 47, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    complianceTitle: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 13.5,
      color: colors.textPrimary,
    },
    complianceSub: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 1,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.xl,
    },
    action: {
      flex: 1,
      gap: 8,
      padding: 15,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    actionPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    actionLabel: {
      fontFamily: fonts.sansBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    mixCard: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    mixHead: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    mixTitle: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14.5,
      color: colors.textPrimary,
    },
    mixSub: {
      fontFamily: fonts.mono,
      fontSize: 10.5,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    ticketList: { paddingHorizontal: spacing.lg, gap: 8 },
  });
