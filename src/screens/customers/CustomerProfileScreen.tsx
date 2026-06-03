import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
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
import { escapeHtml } from '../../utils/validation';
import { useT } from '../../hooks/useT';
import { useIdScanner } from '../../hooks/useIdScanner';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

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
        <Text style={styles.errorText}>{t.error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* ID Photo Section */}
      <View style={styles.idSection}>
        <TouchableOpacity
          style={styles.idPhotoBox}
          onPress={handleScanId}
          disabled={uploading || scanning}
        >
          {uploading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : customer.dl_photo_uri ? (
            <Image
              source={{ uri: customer.dl_photo_uri }}
              style={styles.idPhoto}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.idPlaceholder}>
              <Ionicons name="camera" size={32} color={colors.textTertiary} />
              <Text style={styles.idPlaceholderText}>{t.scanId}</Text>
            </View>
          )}
        </TouchableOpacity>
        {customer.dl_photo_uri && (
          <TouchableOpacity
            style={styles.updateIdButton}
            onPress={handleScanId}
          >
            <Text style={styles.updateIdText}>{t.updateId}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Flag Warning */}
      {customer.is_flagged && (
        <View style={styles.flagBanner}>
          <Ionicons name="warning" size={20} color={colors.danger} />
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

      {/* Customer Info */}
      <View style={styles.infoSection}>
        <View style={styles.infoHeader}>
          <Text style={styles.customerName}>{customer.name}</Text>
          {!editingInfo && (
            <TouchableOpacity onPress={() => setEditingInfo(true)}>
              <Ionicons name="pencil" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
        {customer.phone ? (
          <Text style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.phone}: </Text>
            {customer.phone}
          </Text>
        ) : null}

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
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.editSaveText}>{t.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {customer.drivers_license ? (
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.dlNumber}: </Text>
                {customer.drivers_license}
              </Text>
            ) : null}
            {customer.address ? (
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.address}: </Text>
                {customer.address}
              </Text>
            ) : null}
            {customer.dob ? (
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.dateOfBirth}: </Text>
                {new Date(customer.dob).toLocaleDateString()}
              </Text>
            ) : null}
            {customer.notes ? (
              <Text style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t.customerNotes}: </Text>
                {customer.notes}
              </Text>
            ) : null}
          </>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{receipts.length}</Text>
          <Text style={styles.statLabel}>{t.totalTransactions}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>${totalSpent.toFixed(2)}</Text>
          <Text style={styles.statLabel}>{t.totalSpent}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>
            {new Date(customer.created_at).toLocaleDateString()}
          </Text>
          <Text style={styles.statLabel}>{t.memberSince}</Text>
        </View>
      </View>

      {/* Transaction History */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>{t.customerHistory}</Text>
        {receipts.length === 0 ? (
          <Text style={styles.emptyText}>{t.noTransactions}</Text>
        ) : (
          receipts.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.receiptCard}
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
              <View style={styles.receiptHeader}>
                <Text style={styles.receiptNumber}>{r.receipt_number}</Text>
                <Text style={styles.receiptTotal}>
                  ${Number(r.subtotal).toFixed(2)}
                </Text>
              </View>
              <Text style={styles.receiptDate}>
                {new Date(r.created_at).toLocaleDateString()}
              </Text>
              <Text style={styles.receiptItems}>
                {r.line_items
                  .map(
                    (li) =>
                      `${li.metal_name} (${Number(li.weight).toFixed(2)} lbs)`
                  )
                  .join(', ')}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Flag / Print Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.flagButton,
            customer.is_flagged && styles.flagButtonActive,
          ]}
          onPress={async () => {
            if (customer.is_flagged) {
              await updateCustomer(customer.id, {
                is_flagged: false,
                flag_reason: '',
              });
              setCustomer({ ...customer, is_flagged: false, flag_reason: '' });
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
                      await updateCustomer(customer.id, {
                        is_flagged: true,
                        flag_reason: reason ?? '',
                      });
                      setCustomer({
                        ...customer,
                        is_flagged: true,
                        flag_reason: reason ?? '',
                      });
                    },
                  },
                ],
                'plain-text',
                ''
              );
            }
          }}
        >
          <Ionicons
            name={customer.is_flagged ? 'flag' : 'flag-outline'}
            size={20}
            color={customer.is_flagged ? colors.danger : colors.textSecondary}
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
          onPress={handlePrintStatement}
        >
          <Ionicons name="print" size={20} color={colors.background} />
          <Text style={styles.printButtonText}>{t.printStatement}</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.lg,
  },
  flagBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  flagBannerContent: {
    flex: 1,
  },
  flagBannerText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  flagBannerReason: {
    color: colors.danger,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  actionButtons: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  flagButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  flagButtonActive: {
    borderColor: colors.danger,
    backgroundColor: 'rgba(248, 81, 73, 0.1)',
  },
  flagButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  flagButtonTextActive: {
    color: colors.danger,
  },
  idSection: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  idPhotoBox: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idPhoto: {
    width: '100%',
    height: '100%',
  },
  idPlaceholder: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  idPlaceholderText: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
  },
  updateIdButton: {
    marginTop: spacing.sm,
  },
  updateIdText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  infoSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerName: {
    color: colors.textPrimary,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  infoRow: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
  },
  infoLabel: {
    color: colors.textTertiary,
    fontWeight: '600',
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
    marginBottom: spacing.lg,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
  },
  editFields: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  editLabel: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  editInput: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  editCancelText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  editSaveButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  editSaveText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  historySection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    marginTop: spacing.md,
  },
  receiptCard: {
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptNumber: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  receiptTotal: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  receiptDate: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  receiptItems: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  printButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
  },
  printButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
});
