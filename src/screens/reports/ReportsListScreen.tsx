import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ReportsStackParamList } from '../../navigation/MainNavigator';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { useT } from '../../hooks/useT';
import { useRole } from '../../hooks';
import { useAppSelector, type RootState } from '../../store';
import DateRangeSelector, {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import {
  fetchComplianceReport,
  buildNmrldExportCsv,
  fetchUnreportedReceipts,
  markReceiptsReported,
  type ComplianceReceiptRow,
} from '../../services/reports';
import { Tag, SectionLabel, fmtMoney, fmtLbs } from '../../components/foundry';
import { TareHeader } from '../../components';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

type Props = NativeStackScreenProps<ReportsStackParamList, 'ReportsList'>;

const isRestricted = (r: ComplianceReceiptRow) =>
  !!r.is_catalytic || (r.line_items ?? []).some((li) => li.is_restricted);

async function shareCsv(rows: ComplianceReceiptRow[], name: string) {
  const csv = buildNmrldExportCsv(rows);
  const file = new File(Paths.cache, name);
  file.write(csv);
  // These CSVs contain regulated seller PII (DL #, address, VIN). Purge the
  // cached copy once the share sheet closes so it doesn't linger at rest.
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
    });
  } finally {
    try {
      file.delete();
    } catch {
      /* best effort */
    }
  }
}

export default function ReportsListScreen({ navigation }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const rootNav = useNavigation() as {
    navigate: (name: string, params?: object) => void;
  };
  const profile = useAppSelector((s: RootState) => s.auth.profile);
  const { isAdmin } = useRole();

  const [preset, setPreset] = useState<DatePreset>('month');
  const [rows, setRows] = useState<ComplianceReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(preset);
      setRows(await fetchComplianceReport(start, end));
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [preset]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const restrictedCount = rows.filter(isRestricted).length;
  const unreportedCount = rows.filter((r) => !r.reported_at).length;

  const handleStateUpload = async () => {
    try {
      const unreported = await fetchUnreportedReceipts();
      if (unreported.length === 0) {
        Alert.alert(t.stateUpload, t.noUnreported);
        return;
      }
      await shareCsv(unreported, 'nmrld_unreported.csv');
      Alert.alert(
        t.markReportedTitle,
        t.markReportedConfirm.replace('{n}', String(unreported.length)),
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.confirm,
            onPress: async () => {
              try {
                await markReceiptsReported(
                  unreported.map((r) => r.id),
                  profile?.id ?? ''
                );
                Alert.alert(t.success, t.markedReported);
                load();
              } catch (err) {
                Alert.alert(t.error, (err as Error).message);
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  };

  const detailReports: {
    title: string;
    screen: keyof ReportsStackParamList;
  }[] = [
    { title: t.dailySummary, screen: 'DailySummary' },
    { title: t.inventoryValuation, screen: 'InventoryValuation' },
    { title: t.profitability, screen: 'Profitability' },
    { title: t.shrinkage, screen: 'Shrinkage' },
    { title: t.onHoldReport, screen: 'OnHold' },
    { title: t.reportingStatus, screen: 'ReportingStatus' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <TareHeader title={t.compliance} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >
        <DateRangeSelector selected={preset} onSelect={setPreset} />

        {/* Stats triplet */}
        <View style={styles.triplet}>
          <Stat
            n={rows.length}
            label={t.statTransactions}
            color={colors.textPrimary}
          />
          <View style={styles.tripletDivider} />
          <Stat
            n={restrictedCount}
            label={t.statRestricted}
            color={colors.rust}
          />
          <View style={styles.tripletDivider} />
          <Stat
            n={unreportedCount}
            label={t.statUnreported}
            color={colors.gold}
          />
        </View>

        {/* Deadline strip */}
        {unreportedCount > 0 && (
          <View style={styles.deadline}>
            <Ionicons name="time-outline" size={17} color={colors.rust} />
            <Text style={styles.deadlineText}>
              <Text style={styles.deadlineStrong}>
                {unreportedCount} {t.statUnreported.toLowerCase()}
              </Text>{' '}
              · {t.unreportedDeadline}
            </Text>
          </View>
        )}

        {/* Export actions */}
        <View style={styles.exportGrid}>
          <ExportBtn
            icon="document-text-outline"
            tone={colors.accent}
            label={t.purchaseRecord}
            sub={t.tabReports}
            onPress={() => navigation.navigate('ComplianceReport')}
          />
          <ExportBtn
            icon="shield-outline"
            tone={colors.rust}
            label={t.restrictedReport}
            sub={`${restrictedCount} ${t.flaggedCount}`}
            onPress={() =>
              shareCsv(rows.filter(isRestricted), 'restricted.csv').catch((e) =>
                Alert.alert(t.error, (e as Error).message)
              )
            }
          />
          <ExportBtn
            icon="download-outline"
            tone={colors.teal}
            label={t.exportCsvLabel}
            sub={t.spreadsheet}
            onPress={() =>
              shareCsv(rows, 'compliance.csv').catch((e) =>
                Alert.alert(t.error, (e as Error).message)
              )
            }
          />
          <ExportBtn
            icon={isAdmin ? 'cloud-upload-outline' : 'lock-closed-outline'}
            tone={colors.gold}
            label={t.stateUpload}
            sub={isAdmin ? t.stateReporting : t.adminOnly}
            locked={!isAdmin}
            onPress={handleStateUpload}
          />
        </View>

        {/* Purchase-record ledger */}
        <SectionLabel>{`${t.purchaseRecordsRange} · ${
          preset === 'today'
            ? t.today
            : preset === 'week'
              ? t.thisWeek
              : t.thisMonth
        }`}</SectionLabel>

        {loading ? (
          <ActivityIndicator
            color={colors.accent}
            style={{ marginTop: spacing.xl }}
          />
        ) : rows.length === 0 ? (
          <Text style={styles.emptyText}>{t.noTransactions}</Text>
        ) : (
          <View style={styles.ledger}>
            <View style={styles.ledgerHeader}>
              <Text style={styles.ledgerHeaderLabel}>{t.receiptSeller}</Text>
              <Text style={styles.ledgerHeaderLabel}>{t.paidLabel}</Text>
            </View>
            {rows.map((r, i) => {
              const restricted = isRestricted(r);
              const reported = !!r.reported_at;
              const materials = (r.line_items ?? [])
                .map((li) => `${li.metal_name} (${fmtLbs(li.weight)} lb)`)
                .join(', ');
              const weight = (r.line_items ?? []).reduce(
                (s, li) => s + Number(li.weight),
                0
              );
              return (
                <TouchableOpacity
                  key={r.id}
                  onPress={() =>
                    rootNav.navigate('TransactionsTab', {
                      screen: 'ReceiptDetail',
                      params: { receiptId: r.id },
                    })
                  }
                  style={[
                    styles.ledgerRow,
                    i < rows.length - 1 && styles.ledgerRowBorder,
                    {
                      borderLeftColor: restricted ? colors.rust : 'transparent',
                    },
                  ]}
                >
                  <View style={styles.ledgerTop}>
                    <View style={styles.ledgerSellerLine}>
                      <Text style={styles.ledgerSeller}>
                        {r.seller_name || r.customer_name}
                      </Text>
                      {restricted && (
                        <Ionicons
                          name="alert-circle"
                          size={13}
                          color={colors.rust}
                        />
                      )}
                    </View>
                    <Text style={styles.ledgerPaid}>
                      {fmtMoney(r.subtotal)}
                    </Text>
                  </View>
                  <Text style={styles.ledgerNo}>{r.receipt_number}</Text>
                  <Text style={styles.ledgerMeta}>
                    {[
                      r.seller_dl_number,
                      r.vehicle_plate,
                      `${fmtLbs(weight)} lb`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {!!materials && (
                    <Text style={styles.ledgerMaterials}>{materials}</Text>
                  )}
                  <View style={styles.ledgerTags}>
                    <Tag
                      label={reported ? t.reported : t.queued}
                      color={reported ? colors.moss : colors.gold}
                      icon={reported ? 'checkmark' : 'time-outline'}
                    />
                    <Tag
                      label={r.seller_affirmed ? t.affirmed : t.noAffirm}
                      color={
                        r.seller_affirmed ? colors.textTertiary : colors.rust
                      }
                      icon={r.seller_affirmed ? 'checkmark' : 'close'}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Our extra detailed reports (kept; not in the prototype) */}
        <SectionLabel>{t.detailedReports}</SectionLabel>
        <View style={styles.detailGrid}>
          {detailReports.map((d) => (
            <TouchableOpacity
              key={d.screen}
              style={styles.detailCard}
              onPress={() => navigation.navigate(d.screen)}
            >
              <Text style={styles.detailTitle}>{d.title}</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({
  n,
  label,
  color,
}: {
  n: number;
  label: string;
  color: string;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, { color }]}>{n}</Text>
      <Text style={styles.statL}>{label}</Text>
    </View>
  );
}

function ExportBtn({
  icon,
  tone,
  label,
  sub,
  onPress,
  locked,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  label: string;
  sub: string;
  onPress: () => void;
  locked?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[styles.exportBtn, locked && styles.exportLocked]}
      onPress={onPress}
      disabled={locked}
    >
      <View style={[styles.exportIcon, { backgroundColor: tone + '24' }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.exportLabel} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.exportSub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: spacing.xxxl },
    triplet: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    tripletDivider: { width: 1, backgroundColor: colors.borderSubtle },
    stat: { flex: 1, paddingVertical: 15, alignItems: 'center' },
    statN: {
      fontSize: 26,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
    },
    statL: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 3,
    },
    deadline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: 13,
      backgroundColor: colors.rust + '14',
      borderWidth: 1,
      borderColor: colors.rust + '3d',
    },
    deadlineText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: fonts.sans,
      lineHeight: 17,
    },
    deadlineStrong: { color: colors.textPrimary, fontFamily: fonts.sansBold },
    exportGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    exportBtn: {
      width: '47.5%',
      flexGrow: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    exportLocked: { opacity: 0.6 },
    exportIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exportLabel: {
      color: colors.textPrimary,
      fontSize: 13.5,
      fontFamily: fonts.sansSemiBold,
    },
    exportSub: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.mono,
      marginTop: 1,
    },
    ledger: {
      marginHorizontal: spacing.lg,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    ledgerHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.surface2,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    ledgerHeaderLabel: {
      color: colors.textTertiary,
      fontSize: 9.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    ledgerRow: { padding: spacing.md, borderLeftWidth: 3 },
    ledgerRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    ledgerTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    ledgerSellerLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ledgerSeller: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fonts.sansSemiBold,
    },
    ledgerPaid: {
      color: colors.textPrimary,
      fontSize: 14.5,
      fontFamily: fonts.monoSemiBold,
    },
    ledgerNo: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.mono,
      marginTop: 2,
    },
    ledgerMeta: {
      color: colors.textSecondary,
      fontSize: 10.5,
      fontFamily: fonts.mono,
      marginTop: 6,
    },
    ledgerMaterials: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.sans,
      marginTop: 3,
      lineHeight: 16,
    },
    ledgerTags: { flexDirection: 'row', gap: spacing.md, marginTop: 8 },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 14,
      fontFamily: fonts.sans,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    detailGrid: {
      paddingHorizontal: spacing.lg,
      gap: spacing.sm,
    },
    detailCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
    },
    detailTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
  });
