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
  markReceiptsReported,
} from '../../services/reports';
import { fetchCompanySettings } from '../../services/companySettings';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { useAppSelector, type RootState } from '../../store';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

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
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  };

  // Export only the not-yet-reported buys, then (after the operator uploads to
  // the state DB / LeadsOnline) mark them reported. This is the manual bridge
  // until the automated SFTP job is wired up.
  const handleReportUnreported = async () => {
    try {
      const unreported = await fetchUnreportedReceipts();
      if (unreported.length === 0) {
        Alert.alert(t.nmrldExport, t.noUnreported);
        return;
      }
      const csv = buildNmrldExportCsv(unreported);
      const file = new File(Paths.cache, 'nmrld_unreported.csv');
      file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
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
              <Text style={styles.statNumber}>{restrictedCount}</Text>
              <Text style={styles.statLabel}>{t.restrictedMaterial}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handlePrint(false)}
            >
              <Ionicons name="print" size={20} color={colors.accent} />
              <Text style={styles.actionText}>{t.purchaseRecord}</Text>
            </TouchableOpacity>

            {restrictedCount > 0 && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handlePrint(true)}
              >
                <Ionicons name="warning" size={20} color={colors.warning} />
                <Text style={styles.actionText}>{t.restrictedReport}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleExportCsv}
            >
              <Ionicons name="download-outline" size={20} color={colors.teal} />
              <Text style={styles.actionText}>{t.exportCsv}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleNmrldExport}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={colors.accent}
              />
              <Text style={styles.actionText}>{t.nmrldExport}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleReportUnreported}
            >
              <Ionicons
                name="checkmark-done-outline"
                size={20}
                color={colors.success}
              />
              <Text style={styles.actionText}>{t.reportUnreported}</Text>
            </TouchableOpacity>
          </View>

          {/* Transaction List */}
          {rows.map((row, i) => (
            <View
              key={i}
              style={[
                styles.recordCard,
                row.hasRestricted && styles.recordCardRestricted,
              ]}
            >
              <View style={styles.recordHeader}>
                <Text style={styles.recordReceipt}>{row.receiptNumber}</Text>
                <Text style={styles.recordAmount}>
                  ${row.amountPaid.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.recordSeller}>{row.sellerName}</Text>
              <Text style={styles.recordDetail}>{row.date}</Text>
              <Text style={styles.recordDetail}>{row.materials}</Text>
              {row.dlNumber ? (
                <Text style={styles.recordDetail}>
                  {t.dlNumberShort} {row.dlNumber}
                  {row.stateOfIssue ? ` (${row.stateOfIssue})` : ''}
                </Text>
              ) : null}
              {row.vehiclePlate ? (
                <Text style={styles.recordDetail}>
                  {t.vehiclePlateShort} {row.vehiclePlate}
                  {row.vehicleYear || row.vehicleMake || row.vehicleModel
                    ? ` — ${[row.vehicleYear, row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ')}`
                    : ''}
                  {row.vehicleColor ? ` (${row.vehicleColor})` : ''}
                </Text>
              ) : null}
              {row.hasRestricted && (
                <View style={styles.restrictedTag}>
                  <Text style={styles.restrictedTagText}>
                    {t.restrictedMaterial}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </>
      )}
      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
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
  empty: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: colors.accent,
    fontSize: fontSize.xxl,
    fontFamily: fonts.sansBold,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionText: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  recordCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  recordCardRestricted: {
    borderLeftColor: colors.warning,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordReceipt: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sansSemiBold,
  },
  recordAmount: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
  },
  recordSeller: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
    marginTop: spacing.xs,
  },
  recordDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  restrictedTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(210, 153, 34, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  restrictedTagText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
  },
});
