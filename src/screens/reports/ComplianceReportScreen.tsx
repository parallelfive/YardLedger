import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import DateRangeSelector, {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import {
  fetchComplianceReport,
  exportNmrldCsv,
  fetchUnreportedReceipts,
  buildNmrldExportCsv,
  fetchNmrldRegistrationNumber,
  markReceiptsReported,
} from '../../services/reports';
import { fetchCompanySettings } from '../../services/companySettings';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { useAdminElevation } from '../../providers/AdminElevationProvider';
import { useAppSelector, type RootState } from '../../store';
import { Tag, SectionLabel, fmtMoney } from '../../components/foundry';
import { ResponsiveContainer } from '../../components';
import { type Palette, spacing, fontSize, fonts } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

interface PurchaseRecordRow {
  date: string;
  receiptNumber: string;
  sellerName: string;
  dlNumber: string;
  stateOfIssue: string;
  sellerAddress: string;
  vehiclePlate: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  materials: string;
  totalWeight: number;
  amountPaid: number;
  sellerAffirmed: boolean;
  hasRestricted: boolean;
}

export default function ComplianceReportScreen() {
  const { t } = useT();
  const { ensureElevated } = useAdminElevation();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const profile = useAppSelector((s: RootState) => s.auth.profile);
  const isFocused = useIsFocused();
  const [preset, setPreset] = useState<DatePreset>('today');
  const [rows, setRows] = useState<PurchaseRecordRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange(preset);
      const data = await fetchComplianceReport(start, end);

      const mapped: PurchaseRecordRow[] = data.map((r) => {
        const lineItems = (r.line_items ?? []) as {
          metal_name: string;
          weight: number;
          total: number;
          is_restricted: boolean;
        }[];
        const materials = lineItems
          .map((li) => `${li.metal_name} (${Number(li.weight).toFixed(2)} lbs)`)
          .join(', ');
        const totalWeight = lineItems.reduce(
          (sum, li) => sum + Number(li.weight),
          0
        );
        const hasRestricted = lineItems.some((li) => li.is_restricted);

        const fullAddress = [
          r.seller_address,
          r.seller_city,
          r.seller_state
            ? `${r.seller_state} ${r.seller_zip ?? ''}`
            : r.seller_zip,
        ]
          .filter(Boolean)
          .join(', ');

        return {
          date: new Date(r.created_at).toLocaleDateString(),
          receiptNumber: r.receipt_number,
          sellerName: r.seller_name || r.customer_name,
          dlNumber: r.seller_dl_number ?? '',
          stateOfIssue: r.seller_state_of_issue ?? '',
          sellerAddress: fullAddress,
          vehiclePlate: r.vehicle_plate ?? '',
          vehicleYear: r.vehicle_year ?? '',
          vehicleMake: r.vehicle_make ?? '',
          vehicleModel: r.vehicle_model ?? '',
          vehicleColor: r.vehicle_color ?? '',
          materials,
          totalWeight,
          amountPaid: Number(r.subtotal),
          sellerAffirmed: r.seller_affirmed ?? false,
          hasRestricted,
        };
      });

      setRows(mapped);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [preset, t.error]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [loadData, isFocused]);

  const buildHtml = async (restrictedOnly: boolean) => {
    const company = await fetchCompanySettings();
    const filtered = restrictedOnly
      ? rows.filter((r) => r.hasRestricted)
      : rows;

    const title = restrictedOnly ? t.restrictedReport : t.purchaseRecord;
    const companyHeader = company
      ? `<h2 style="margin:0">${company.company_name}</h2>
         <p style="margin:4px 0;color:#666">${company.address} | ${company.phone}</p>`
      : '';

    const vehicleDesc = (r: PurchaseRecordRow) =>
      [r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(' ');

    const tableRows = filtered
      .map(
        (r) => `<tr>
        <td>${r.date}</td>
        <td>${r.receiptNumber}</td>
        <td>${r.sellerName}</td>
        <td>${r.dlNumber}${r.stateOfIssue ? ` (${r.stateOfIssue})` : ''}</td>
        <td>${r.sellerAddress}</td>
        <td>${r.vehiclePlate}</td>
        <td>${vehicleDesc(r)}${r.vehicleColor ? ` — ${r.vehicleColor}` : ''}</td>
        <td>${r.materials}</td>
        <td style="text-align:right">${r.totalWeight.toFixed(2)}</td>
        <td style="text-align:right">$${r.amountPaid.toFixed(2)}</td>
        <td>${r.sellerAffirmed ? 'Yes' : 'No'}</td>
      </tr>`
      )
      .join('');

    const totalPaid = filtered.reduce((s, r) => s + r.amountPaid, 0);

    return `<html><head><style>
      body { font-family: sans-serif; padding: 16px; font-size: 11px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
      th { background: #f5f5f5; font-weight: bold; font-size: 10px; }
      .header { text-align: center; margin-bottom: 16px; }
      h3 { margin: 4px 0; }
    </style></head><body>
      <div class="header">
        ${companyHeader}
        <hr/>
        <h3>${title}</h3>
        <p style="color:#666">${t.generatedOn} ${new Date().toLocaleDateString()}</p>
      </div>
      <table>
        <thead><tr>
          <th>${t.transactionDate}</th>
          <th>${t.receipt}</th>
          <th>${t.sellerName}</th>
          <th>${t.dlNumberShort}</th>
          <th>${t.address}</th>
          <th>${t.vehiclePlateShort}</th>
          <th>${t.vehicleInfo}</th>
          <th>${t.materialDescription}</th>
          <th style="text-align:right">${t.weightLbsLabel}</th>
          <th style="text-align:right">${t.amountPaid}</th>
          <th>${t.affirmed}</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
        <tfoot><tr>
          <td colspan="9" style="text-align:right;font-weight:bold">${t.total}</td>
          <td style="text-align:right;font-weight:bold">$${totalPaid.toFixed(2)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      <p style="margin-top:12px;color:#666;font-size:10px">
        ${filtered.length} transactions | NM Sale of Recycled Metals Act
      </p>
    </body></html>`;
  };

  const handlePrint = async (restrictedOnly: boolean) => {
    try {
      const html = await buildHtml(restrictedOnly);
      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  };

  const handleExportCsv = async () => {
    try {
      const header =
        'Date,Receipt #,Seller Name,State/ID Number,State of Issue,Address,License Plate,Vehicle Year,Vehicle Make,Vehicle Model,Vehicle Color,Materials,Weight (lbs),Amount Paid,Seller Affirmed,Restricted\n';
      const csvRows = rows
        .map(
          (r) =>
            `"${r.date}","${r.receiptNumber}","${r.sellerName}","${r.dlNumber}","${r.stateOfIssue}","${r.sellerAddress}","${r.vehiclePlate}","${r.vehicleYear}","${r.vehicleMake}","${r.vehicleModel}","${r.vehicleColor}","${r.materials}",${r.totalWeight.toFixed(2)},${r.amountPaid.toFixed(2)},${r.sellerAffirmed},${r.hasRestricted}`
        )
        .join('\n');

      const file = new File(Paths.cache, 'purchase_records.csv');
      file.write(header + csvRows);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
      // Regulated PII — don't leave the export lingering in the cache dir.
      try {
        file.delete();
      } catch {
        /* best effort */
      }
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  };

  // Structured upload file for the NM recycled-metals database (57-30-8/9) —
  // one row per metal line with VIN, payment method, hold date and catalytic
  // flag. Distinct from the human-readable purchase-record CSV above.
  const handleNmrldExport = async () => {
    try {
      const { start, end } = getDateRange(preset);
      const csv = await exportNmrldCsv(start, end);
      const file = new File(Paths.cache, 'nmrld_upload.csv');
      file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
      // Regulated PII — don't leave the export lingering in the cache dir.
      try {
        file.delete();
      } catch {
        /* best effort */
      }
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  };

  // Export only the not-yet-reported buys, then (after the operator uploads to
  // the state DB / LeadsOnline) mark them reported. This is the manual bridge
  // until the automated SFTP job is wired up.
  const handleReportUnreported = async () => {
    try {
      const [unreported, registration] = await Promise.all([
        fetchUnreportedReceipts(),
        fetchNmrldRegistrationNumber(),
      ]);
      if (unreported.length === 0) {
        Alert.alert(t.nmrldExport, t.noUnreported);
        return;
      }
      const csv = buildNmrldExportCsv(unreported, registration);
      const file = new File(Paths.cache, 'nmrld_unreported.csv');
      file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
      // Regulated PII — don't leave the export lingering in the cache dir.
      try {
        file.delete();
      } catch {
        /* best effort */
      }
      Alert.alert(
        t.markReportedTitle,
        t.markReportedConfirm.replace('{n}', String(unreported.length)),
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.confirm,
            onPress: async () => {
              if (!(await ensureElevated())) return;
              try {
                await markReceiptsReported(
                  unreported.map((r) => r.id),
                  profile?.id ?? ''
                );
                Alert.alert(t.success, t.markedReported);
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

  const restrictedCount = rows.filter((r) => r.hasRestricted).length;

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
        ) : rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.noDataForRange}</Text>
          </View>
        ) : (
          <>
            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{rows.length}</Text>
                <Text style={styles.statLabel}>{t.totalTransactions}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statNumber, { color: colors.rust }]}>
                  {restrictedCount}
                </Text>
                <Text style={styles.statLabel}>{t.restrictedMaterial}</Text>
              </View>
            </View>

            {/* Export / report actions */}
            <SectionLabel>{t.tabReports}</SectionLabel>
            <View style={styles.exportGrid}>
              <ExportBtn
                icon="print-outline"
                tone={colors.accent}
                label={t.purchaseRecord}
                sub={t.tabReports}
                onPress={() => handlePrint(false)}
              />
              {restrictedCount > 0 && (
                <ExportBtn
                  icon="shield-outline"
                  tone={colors.rust}
                  label={t.restrictedReport}
                  sub={`${restrictedCount} ${t.flaggedCount}`}
                  onPress={() => handlePrint(true)}
                />
              )}
              <ExportBtn
                icon="download-outline"
                tone={colors.teal}
                label={t.exportCsv}
                sub={t.spreadsheet}
                onPress={handleExportCsv}
              />
              <ExportBtn
                icon="cloud-upload-outline"
                tone={colors.gold}
                label={t.nmrldExport}
                sub={t.stateReporting}
                onPress={handleNmrldExport}
              />
              <ExportBtn
                icon="checkmark-done-outline"
                tone={colors.moss}
                label={t.reportUnreported}
                sub={t.awaitingReport}
                onPress={handleReportUnreported}
              />
            </View>

            {/* Transaction List */}
            <SectionLabel>{t.purchaseRecord}</SectionLabel>
            <View style={styles.list}>
              {rows.map((row, i) => {
                const vehicle = [
                  row.vehicleYear,
                  row.vehicleMake,
                  row.vehicleModel,
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <View
                    key={i}
                    style={[
                      styles.recordCard,
                      {
                        borderLeftColor: row.hasRestricted
                          ? colors.rust
                          : colors.accent,
                      },
                    ]}
                  >
                    <View style={styles.recordHeader}>
                      <View style={styles.recordTitleLine}>
                        <Text style={styles.recordSeller}>
                          {row.sellerName}
                        </Text>
                        {row.hasRestricted && (
                          <Ionicons
                            name="alert-circle"
                            size={13}
                            color={colors.rust}
                          />
                        )}
                      </View>
                      <Text style={styles.recordAmount}>
                        {fmtMoney(row.amountPaid)}
                      </Text>
                    </View>
                    <Text style={styles.recordReceipt}>
                      {row.receiptNumber}
                    </Text>
                    <Text style={styles.recordMeta}>
                      {[
                        row.date,
                        row.dlNumber
                          ? `${t.dlNumberShort} ${row.dlNumber}${row.stateOfIssue ? ` (${row.stateOfIssue})` : ''}`
                          : null,
                        row.vehiclePlate
                          ? `${t.vehiclePlateShort} ${row.vehiclePlate}${vehicle ? ` — ${vehicle}` : ''}${row.vehicleColor ? ` (${row.vehicleColor})` : ''}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {!!row.materials && (
                      <Text style={styles.recordMaterials}>
                        {row.materials}
                      </Text>
                    )}
                    <View style={styles.recordTags}>
                      <Tag
                        label={row.sellerAffirmed ? t.affirmed : t.noAffirm}
                        color={
                          row.sellerAffirmed ? colors.textTertiary : colors.rust
                        }
                        icon={row.sellerAffirmed ? 'checkmark' : 'close'}
                      />
                      {row.hasRestricted && (
                        <Tag
                          label={t.restrictedMaterial}
                          color={colors.rust}
                          soft={colors.rust + '22'}
                          icon="warning"
                        />
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
        <View style={{ height: spacing.xxxl }} />
      </ResponsiveContainer>
    </ScrollView>
  );
}

function ExportBtn({
  icon,
  tone,
  label,
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: string;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.exportBtn} onPress={onPress}>
      <View style={[styles.exportIcon, { backgroundColor: tone + '24' }]}>
        <Ionicons name={icon} size={18} color={tone} />
      </View>
      <View style={styles.exportTextWrap}>
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
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loader: {
      marginTop: spacing.xxxl,
    },
    empty: {
      padding: spacing.xxxl,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sans,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 15,
      marginBottom: spacing.lg,
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
    },
    statNumber: {
      color: colors.textPrimary,
      fontSize: 26,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
    },
    statLabel: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 3,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.borderSubtle,
      alignSelf: 'stretch',
    },
    exportGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
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
    exportIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    exportTextWrap: { flex: 1, minWidth: 0 },
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
    list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
    recordCard: {
      backgroundColor: colors.card,
      padding: spacing.md,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderLeftWidth: 3,
    },
    recordHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    recordTitleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    recordReceipt: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.mono,
      marginTop: 2,
    },
    recordAmount: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fonts.monoSemiBold,
    },
    recordSeller: {
      color: colors.textPrimary,
      fontSize: 14.5,
      fontFamily: fonts.sansSemiBold,
      flexShrink: 1,
    },
    recordMeta: {
      color: colors.textSecondary,
      fontSize: 10.5,
      fontFamily: fonts.mono,
      marginTop: 6,
      lineHeight: 15,
    },
    recordMaterials: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.sans,
      marginTop: 3,
      lineHeight: 16,
    },
    recordTags: { flexDirection: 'row', gap: spacing.md, marginTop: 8 },
  });
