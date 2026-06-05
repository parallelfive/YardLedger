import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomersStackParamList } from '../../navigation/MainNavigator';
import * as Print from 'expo-print';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchCustomerById,
  fetchCustomerReceipts,
  updateCustomer,
  uploadCustomerIdPhoto,
  type Customer,
} from '../../services/customers';
import { fetchCompanySettings } from '../../services/companySettings';
import { SignedImage } from '../../components';
import { SectionLabel, Tag, fmtMoney, fmtLbs } from '../../components/foundry';
import { escapeHtml } from '../../utils/validation';
import { useT } from '../../hooks/useT';
import { useIdScanner } from '../../hooks/useIdScanner';
import { useTheme, useThemedStyles } from '../../theme';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomerProfile'>;

interface ReceiptRow {
  id: string;
  receipt_number: string;
  subtotal: number;
  created_at: string;
  line_items: { metal_name: string; weight: number; total: number }[];
}

export default function CustomerProfileScreen({ route, navigation }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { customerId } = route.params;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [dlNumber, setDlNumber] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const { scanning, scanAndRecognize } = useIdScanner();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, r] = await Promise.all([
        fetchCustomerById(customerId),
        fetchCustomerReceipts(customerId),
      ]);
      setCustomer(c);
      setReceipts(r as ReceiptRow[]);
      if (c) {
        setNotes(c.notes);
        setDlNumber(c.drivers_license);
        setAddress(c.address);
        setDob(c.dob ?? '');
      }
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [customerId, t.error]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleScanId = async () => {
    if (!customer) return;
    const scanResult = await scanAndRecognize();
    if (!scanResult) return;

    const { imageUri, fields } = scanResult;

    // Pre-fill empty fields from OCR
    if (fields.driversLicense && !dlNumber.trim())
      setDlNumber(fields.driversLicense);
    if (fields.address && !address.trim()) setAddress(fields.address);
    if (fields.dob && !dob.trim()) setDob(fields.dob);

    // Open edit mode so worker can review/correct OCR results
    setEditingInfo(true);

    // Upload the clean scanned image
    setUploading(true);
    try {
      const url = await uploadCustomerIdPhoto(customer.id, imageUri);
      setCustomer({ ...customer, dl_photo_uri: url });
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!customer) return;
    setSavingInfo(true);
    try {
      const updates = {
        drivers_license: dlNumber.trim(),
        address: address.trim(),
        dob: dob.trim() || null,
        notes: notes.trim(),
      };
      await updateCustomer(customer.id, updates);
      setCustomer({ ...customer, ...updates });
      setEditingInfo(false);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSavingInfo(false);
    }
  };

  const totalSpent = receipts.reduce(
    (sum, r) => sum + Number(r.subtotal ?? 0),
    0
  );

  const handlePrintStatement = async () => {
    if (!customer) return;
    try {
      const company = await fetchCompanySettings();
      const companyHeader = company
        ? `<h2 style="margin:0">${escapeHtml(company.company_name)}</h2>
           <p style="margin:4px 0;color:#666">${escapeHtml(company.address)}</p>
           <p style="margin:4px 0;color:#666">${escapeHtml(company.phone)}</p>`
        : '';

      const rows = receipts
        .map(
          (r) => `
        <tr>
          <td>${new Date(r.created_at).toLocaleDateString()}</td>
          <td>${escapeHtml(r.receipt_number)}</td>
          <td>${r.line_items.map((li) => `${escapeHtml(li.metal_name)} (${Number(li.weight).toFixed(2)} lbs)`).join(', ')}</td>
          <td style="text-align:right">$${Number(r.subtotal).toFixed(2)}</td>
        </tr>`
        )
        .join('');

      const html = `
        <html><head><style>
          body { font-family: sans-serif; padding: 20px; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .header { text-align: center; margin-bottom: 20px; }
          .summary { margin: 16px 0; padding: 12px; background: #f9f9f9; border-radius: 8px; }
        </style></head><body>
          <div class="header">
            ${companyHeader}
            <hr/>
            <h3>${t.statementFor} ${escapeHtml(customer.name)}</h3>
            <p style="color:#666">${t.generatedOn} ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="summary">
            <strong>${t.totalTransactions}:</strong> ${receipts.length} &nbsp;&nbsp;
            <strong>${t.totalSpent}:</strong> $${totalSpent.toFixed(2)}
          </div>
          ${customer.drivers_license ? `<p><strong>${t.dlNumber}:</strong> ${escapeHtml(customer.drivers_license)}</p>` : ''}
          ${customer.phone ? `<p><strong>${t.phone}:</strong> ${escapeHtml(customer.phone)}</p>` : ''}
          <table>
            <thead><tr>
              <th>${t.transactionDate}</th>
              <th>${t.receipt}</th>
              <th>${t.materialDescription}</th>
              <th style="text-align:right">${t.amountPaid}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr>
              <td colspan="3" style="text-align:right;font-weight:bold">${t.total}</td>
              <td style="text-align:right;font-weight:bold">$${totalSpent.toFixed(2)}</td>
            </tr></tfoot>
          </table>
        </body></html>`;

      await Print.printAsync({ html });
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  };

  const handleToggleFlag = async () => {
    if (!customer) return;
    if (customer.is_flagged) {
      try {
        await updateCustomer(customer.id, {
          is_flagged: false,
          flag_reason: '',
        });
        setCustomer({ ...customer, is_flagged: false, flag_reason: '' });
      } catch (err) {
        Alert.alert(t.error, (err as Error).message);
      }
    } else {
      Alert.prompt(
        t.flagCustomer,
        t.flagReasonPlaceholder,
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.flagCustomer,
            style: 'destructive',
            onPress: async (reason: string | undefined) => {
              try {
                await updateCustomer(customer.id, {
                  is_flagged: true,
                  flag_reason: reason ?? '',
                });
                setCustomer({
                  ...customer,
                  is_flagged: true,
                  flag_reason: reason ?? '',
                });
              } catch (err) {
                Alert.alert(t.error, (err as Error).message);
              }
            },
          },
        ],
        'plain-text',
        ''
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={styles.centered}>
        <Ionicons
          name="alert-circle-outline"
          size={40}
          color={colors.textTertiary}
        />
        <Text style={styles.errorText}>{t.error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Flag banner */}
      {customer.is_flagged && (
        <View style={styles.flagBanner}>
          <Ionicons name="alert-circle-outline" size={20} color={colors.rust} />
          <View style={styles.flagBannerContent}>
            <Text style={styles.flagBannerText}>{t.flagWarning}</Text>
            {customer.flag_reason ? (
              <Text style={styles.flagBannerReason}>
                {customer.flag_reason}
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Identity card */}
      <View style={styles.identityCard}>
        <View style={styles.identityHeader}>
          <View style={styles.identityName}>
            <Text style={styles.customerName} numberOfLines={2}>
              {customer.name}
            </Text>
            {customer.phone ? (
              <Text style={styles.customerPhone}>{customer.phone}</Text>
            ) : null}
          </View>
          {customer.dl_photo_uri ? (
            <Tag
              label={t.idOnFile}
              color={colors.moss}
              soft={colors.moss + '22'}
              icon="checkmark"
            />
          ) : (
            <Tag
              label={t.noIdOnFile}
              color={colors.gold}
              soft={colors.gold + '22'}
            />
          )}
        </View>

        {/* ID photo */}
        <TouchableOpacity
          style={styles.idPhotoBox}
          onPress={handleScanId}
          disabled={uploading || scanning}
          activeOpacity={0.8}
        >
          {uploading || scanning ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : customer.dl_photo_uri ? (
            <>
              <SignedImage
                value={customer.dl_photo_uri}
                style={styles.idPhoto}
                resizeMode="contain"
              />
              <View style={styles.idPhotoOverlay}>
                <Ionicons
                  name="camera-outline"
                  size={14}
                  color={colors.white}
                />
                <Text style={styles.idPhotoOverlayText}>{t.updateId}</Text>
              </View>
            </>
          ) : (
            <View style={styles.idPlaceholder}>
              <Ionicons
                name="scan-outline"
                size={30}
                color={colors.textTertiary}
              />
              <Text style={styles.idPlaceholderText}>{t.scanId}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t.totalTransactions}</Text>
          <Text style={styles.statValue}>{receipts.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t.totalSpent}</Text>
          <Text style={styles.statValue}>{fmtMoney(totalSpent)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t.memberSince}</Text>
          <Text style={[styles.statValue, styles.statValueSmall]}>
            {new Date(customer.created_at).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* Details */}
      <SectionLabel
        actionLabel={editingInfo ? undefined : t.edit}
        onAction={editingInfo ? undefined : () => setEditingInfo(true)}
      >
        {t.detailsLabel}
      </SectionLabel>

      <View style={styles.detailCard}>
        {editingInfo ? (
          <View style={styles.editFields}>
            <Text style={styles.editLabel}>{t.dlNumber}</Text>
            <TextInput
              style={styles.editInput}
              value={dlNumber}
              onChangeText={setDlNumber}
              placeholder="DL-123456789"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={styles.editLabel}>{t.address}</Text>
            <TextInput
              style={styles.editInput}
              value={address}
              onChangeText={setAddress}
              placeholder={t.address}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />
            <Text style={styles.editLabel}>{t.dateOfBirth}</Text>
            <TextInput
              style={styles.editInput}
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={styles.editLabel}>{t.customerNotes}</Text>
            <TextInput
              style={[styles.editInput, styles.editInputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder={t.notesPlaceholder}
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelButton}
                onPress={() => {
                  setDlNumber(customer.drivers_license);
                  setAddress(customer.address);
                  setDob(customer.dob ?? '');
                  setNotes(customer.notes);
                  setEditingInfo(false);
                }}
              >
                <Text style={styles.editCancelText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveButton}
                onPress={handleSaveInfo}
                disabled={savingInfo}
              >
                {savingInfo ? (
                  <ActivityIndicator color={colors.accentInk} size="small" />
                ) : (
                  <Text style={styles.editSaveText}>{t.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <DetailRow
              label={t.dlNumber}
              value={customer.drivers_license || '—'}
            />
            <DetailRow label={t.address} value={customer.address || '—'} />
            <DetailRow
              label={t.dateOfBirth}
              value={
                customer.dob ? new Date(customer.dob).toLocaleDateString() : '—'
              }
            />
            <DetailRow
              label={t.customerNotes}
              value={customer.notes || '—'}
              last
            />
          </>
        )}
      </View>

      {/* History */}
      <SectionLabel>{t.customerHistory}</SectionLabel>
      {receipts.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Ionicons
            name="receipt-outline"
            size={28}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>{t.noTransactions}</Text>
        </View>
      ) : (
        <View style={styles.historyList}>
          {receipts.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.receiptRow}
              activeOpacity={0.7}
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) {
                  parent.navigate('TransactionsTab', {
                    screen: 'ReceiptDetail',
                    params: { receiptId: r.id },
                  });
                }
              }}
            >
              <View style={styles.receiptIcon}>
                <Ionicons
                  name="receipt-outline"
                  size={18}
                  color={colors.accent}
                />
              </View>
              <View style={styles.receiptInfo}>
                <Text style={styles.receiptNumber} numberOfLines={1}>
                  {r.receipt_number}
                </Text>
                <Text style={styles.receiptItems} numberOfLines={1}>
                  {r.line_items
                    .map(
                      (li) =>
                        `${li.metal_name} (${fmtLbs(Number(li.weight))} lb)`
                    )
                    .join(', ')}
                </Text>
              </View>
              <View style={styles.receiptRight}>
                <Text style={styles.receiptTotal}>
                  {fmtMoney(Number(r.subtotal))}
                </Text>
                <Text style={styles.receiptDate}>
                  {new Date(r.created_at).toLocaleDateString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.flagButton,
            customer.is_flagged && styles.flagButtonActive,
          ]}
          activeOpacity={0.8}
          onPress={handleToggleFlag}
        >
          <Ionicons
            name={customer.is_flagged ? 'flag' : 'flag-outline'}
            size={18}
            color={customer.is_flagged ? colors.rust : colors.textSecondary}
          />
          <Text
            style={[
              styles.flagButtonText,
              customer.is_flagged && styles.flagButtonTextActive,
            ]}
          >
            {customer.is_flagged ? t.unflagCustomer : t.flagCustomer}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.printButton}
          activeOpacity={0.8}
          onPress={handlePrintStatement}
        >
          <Ionicons name="print-outline" size={18} color={colors.accentInk} />
          <Text style={styles.printButtonText}>{t.printStatement}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      gap: spacing.sm,
    },
    errorText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
    },
    // Flag banner
    flagBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.rust + '1A',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.rust,
    },
    flagBannerContent: { flex: 1 },
    flagBannerText: {
      color: colors.rust,
      fontSize: fontSize.md,
      fontFamily: fonts.sansBold,
    },
    flagBannerReason: {
      color: colors.rust,
      fontSize: fontSize.sm,
      fontFamily: fonts.sans,
      marginTop: spacing.xs,
    },
    // Identity card
    identityCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    identityHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    identityName: { flex: 1, minWidth: 0 },
    customerName: {
      color: colors.textPrimary,
      fontSize: 24,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
    },
    customerPhone: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: fonts.mono,
      marginTop: 4,
    },
    idPhotoBox: {
      width: '100%',
      height: 190,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      overflow: 'hidden',
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    idPhoto: { width: '100%', height: '100%' },
    idPhotoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    idPhotoOverlayText: {
      color: colors.white,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
    },
    idPlaceholder: { alignItems: 'center', gap: spacing.sm },
    idPlaceholderText: {
      color: colors.textTertiary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    // Stats
    statsRow: { flexDirection: 'row', gap: spacing.sm },
    statCard: {
      flex: 1,
      padding: spacing.md,
      borderRadius: 15,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: 20,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
      marginTop: 4,
    },
    statValueSmall: { fontSize: 13, fontFamily: fonts.monoSemiBold },
    // Detail card
    detailCard: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    detailRowLast: { borderBottomWidth: 0 },
    detailLabel: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    detailValue: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      textAlign: 'right',
    },
    // Edit
    editFields: { gap: spacing.sm, paddingVertical: spacing.md },
    editLabel: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      marginTop: spacing.xs,
    },
    editInput: {
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editInputMultiline: { minHeight: 80, textAlignVertical: 'top' },
    editActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.sm,
      marginTop: spacing.md,
      alignItems: 'center',
    },
    editCancelButton: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    editCancelText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    editSaveButton: {
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.sm + 2,
      borderRadius: borderRadius.md,
    },
    editSaveText: {
      color: colors.accentInk,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    // History
    historyList: { gap: spacing.sm },
    emptyHistory: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xl,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
    },
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
    },
    receiptIcon: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.accentMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    receiptInfo: { flex: 1, minWidth: 0 },
    receiptNumber: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fonts.monoSemiBold,
    },
    receiptItems: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
      marginTop: 3,
    },
    receiptRight: { alignItems: 'flex-end', gap: 2 },
    receiptTotal: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fonts.monoSemiBold,
    },
    receiptDate: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
    },
    // Actions
    actionButtons: { gap: spacing.sm, marginTop: spacing.xs },
    flagButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    flagButtonActive: {
      borderColor: colors.rust,
      backgroundColor: colors.rust + '1A',
    },
    flagButtonText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    flagButtonTextActive: { color: colors.rust },
    printButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.accent,
      padding: spacing.lg,
      borderRadius: borderRadius.lg,
    },
    printButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
  });
