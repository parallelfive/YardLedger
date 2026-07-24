import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useT } from '../../hooks/useT';
import {
  fetchReceiptById,
  deleteReceipt,
  markReceiptDisposed,
} from '../../services/receipts';
import { SignedImage, ResponsiveContainer } from '../../components';
import { useAdminElevation } from '../../providers/AdminElevationProvider';
import { Tag, fmtMoney, fmtLbs } from '../../components/foundry';
import { printReceipt, shareReceipt } from '../../utils/printReceipt';
import {
  printNmPurchaseRecord,
  printNmCatConverterForm,
} from '../../utils/printNmForms';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

interface ReceiptLineItem {
  id: string;
  metal_name: string;
  weight: number;
  gross_weight?: number | null;
  tare_weight?: number | null;
  price_per_lb: number;
  total: number;
  is_price_override: boolean;
  original_price_per_lb?: number;
}

interface ReceiptDetail {
  id: string;
  receipt_number: string;
  customer_name: string;
  customer_phone?: string;
  vehicle_plate?: string;
  vehicle_description?: string;
  vehicle_year?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_color?: string;
  seller_affirmed?: boolean;
  seller_name?: string;
  seller_dl_number?: string;
  seller_state_of_issue?: string;
  seller_dob?: string;
  seller_address?: string;
  seller_city?: string;
  seller_state?: string;
  seller_zip?: string;
  seller_id_photo_uri?: string | null;
  seller_photo_uri?: string | null;
  material_photo_uri?: string | null;
  cat_converter_numbers?: string;
  transport_vin?: string;
  cat_converter_photo_uri?: string | null;
  cat_title_photo_uri?: string | null;
  payment_method?: string | null;
  is_catalytic?: boolean | null;
  hold_until?: string | null;
  disposed_at?: string | null;
  reported_at?: string | null;
  subtotal: number;
  signature_uri?: string | null;
  created_at: string;
  line_items: ReceiptLineItem[];
}

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'ReceiptDetail'
>;

// ── reusable detail-table row ────────────────────────────────
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
    <View style={[styles.detailRow, last ? styles.detailRowLast : null]}>
      <Text style={styles.detailKey}>{label}</Text>
      <Text style={styles.detailVal}>{value}</Text>
    </View>
  );
}

// ── reusable labelled section card (kept from old data wiring) ─
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function ReceiptDetailScreen({ route, navigation }: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { ensureElevated } = useAdminElevation();
  const { receiptId, printOnLoad } = route.params;
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const handlePrint = useCallback(
    async (data?: ReceiptDetail) => {
      const target = data ?? receipt;
      if (!target) return;
      try {
        await printReceipt(target);
      } catch (err) {
        Alert.alert(t.error, (err as Error).message);
      }
    },
    [receipt, t.error]
  );

  const handleShare = useCallback(async () => {
    if (!receipt) return;
    try {
      await shareReceipt(receipt);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  }, [receipt, t.error]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchReceiptById(receiptId);
        setReceipt(data);

        if (printOnLoad && data) {
          // Print directly without going through handlePrint to avoid dep cycle
          try {
            await printReceipt(data);
          } catch (err) {
            Alert.alert(t.error, (err as Error).message);
          }
        }
      } catch (err) {
        Alert.alert(t.error, (err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [receiptId, printOnLoad, t.error]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!receipt) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{t.error}</Text>
      </View>
    );
  }

  const lineItems = receipt.line_items ?? [];
  const totalWeight = lineItems.reduce(
    (sum, item) => sum + Number(item.weight || 0),
    0
  );
  const restricted = !!receipt.is_catalytic;
  const reported = !!receipt.reported_at;
  const holdActive = !!receipt.hold_until && !receipt.disposed_at;
  const longHold = restricted; // catalytic => 3-year record retention (hold is 24h for all)
  const paymentLabel = receipt.payment_method
    ? receipt.payment_method === 'cash'
      ? t.paymentCash
      : receipt.payment_method === 'check'
        ? t.paymentCheck
        : t.paymentOther
    : t.paymentCash;
  const heldUntilText = receipt.hold_until
    ? new Date(receipt.hold_until).toLocaleDateString()
    : null;

  const time = new Date(receipt.created_at).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg },
        ]}
      >
        <ResponsiveContainer maxWidth={640}>
          {/* Centered big total + receipt number + customer · time */}
          <View style={styles.heroBlock}>
            <Text style={styles.heroNo}>{receipt.receipt_number}</Text>
            <Text style={styles.heroTotal}>{fmtMoney(receipt.subtotal)}</Text>
            <Text style={styles.heroMeta}>
              {receipt.customer_name} · {time}
            </Text>
          </View>

          {/* Restricted reporting notice */}
          {restricted ? (
            <View style={styles.restrictedNotice}>
              <Ionicons name="shield-outline" size={18} color={colors.rust} />
              <Text style={styles.noticeText}>
                {reported ? t.reportedToState : t.awaitingStateReport}
              </Text>
              <Tag
                label={reported ? t.sent : t.queued}
                color={reported ? colors.moss : colors.gold}
                soft={reported ? 'rgba(93, 122, 78, 0.16)' : colors.gold + '26'}
              />
            </View>
          ) : null}

          {/* Hold notice — 24h for all tiers incl. catalytic (NM 57-30, corrected
              from the old 60-day). Record retention differs and is shown below. */}
          {holdActive ? (
            <View style={styles.holdNotice}>
              <Ionicons name="time-outline" size={18} color={colors.gold} />
              <Text style={styles.noticeText}>
                {t.hold24}
                {heldUntilText ? ` · ${t.holdUntil} ${heldUntilText}` : ''}
              </Text>
              <Tag
                label={t.held}
                color={colors.gold}
                soft={colors.gold + '26'}
                icon="lock-closed"
              />
            </View>
          ) : null}

          {receipt.disposed_at ? (
            <View style={styles.holdNotice}>
              <Ionicons
                name="checkmark-done-outline"
                size={18}
                color={colors.moss}
              />
              <Text style={styles.noticeText}>{t.disposed}</Text>
            </View>
          ) : null}

          {/* Bordered detail table */}
          <View style={styles.detailTable}>
            <DetailRow label={t.weightLb} value={`${fmtLbs(totalWeight)} lb`} />
            <DetailRow label={t.items} value={String(lineItems.length)} />
            <DetailRow label={t.paymentMethodLabel} value={paymentLabel} />
            <DetailRow
              label={t.retention}
              value={longHold ? t.retention3 : t.retention1}
            />
            <DetailRow
              label={t.worker}
              value={receipt.seller_name || '—'}
              last
            />
          </View>

          {/* Line items */}
          <Section title={`${t.items} (${lineItems.length})`}>
            {lineItems.map((item, index) => (
              <View key={item.id ?? index} style={styles.lineItem}>
                <View style={styles.lineItemLeft}>
                  <View style={styles.lineItemHeader}>
                    <Text style={styles.metalName}>{item.metal_name}</Text>
                    {item.is_price_override && (
                      <View style={styles.overrideBadge}>
                        <Text style={styles.overrideBadgeText}>
                          {t.priceOverride}
                        </Text>
                      </View>
                    )}
                  </View>
                  {item.gross_weight != null && item.tare_weight != null ? (
                    <>
                      <Text style={styles.tareDetail}>
                        {t.grossWeightLabel}:{' '}
                        {Number(item.gross_weight).toFixed(2)} —{' '}
                        {t.tareWeightLabel}:{' '}
                        {Number(item.tare_weight).toFixed(2)}
                      </Text>
                      <Text style={styles.lineItemDetail}>
                        {t.netWeightResult} {Number(item.weight).toFixed(2)} lbs
                        @ ${Number(item.price_per_lb).toFixed(4)}/lb
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.lineItemDetail}>
                      {Number(item.weight).toFixed(2)} lbs @ $
                      {Number(item.price_per_lb).toFixed(4)}/lb
                    </Text>
                  )}
                  {item.is_price_override && item.original_price_per_lb && (
                    <Text style={styles.originalPrice}>
                      was ${Number(item.original_price_per_lb).toFixed(4)}/lb
                    </Text>
                  )}
                </View>
                <Text style={styles.lineItemTotal}>
                  {fmtMoney(Number(item.total))}
                </Text>
              </View>
            ))}
          </Section>

          {/* Seller ID — regulated materials */}
          {receipt.seller_name ? (
            <Section title={t.sellerIdInfo}>
              {receipt.seller_id_photo_uri ? (
                <View style={styles.photoBox}>
                  <SignedImage
                    value={receipt.seller_id_photo_uri}
                    style={styles.photo}
                    resizeMode="contain"
                  />
                </View>
              ) : null}
              <Text style={styles.customerName}>{receipt.seller_name}</Text>
              {receipt.seller_dl_number ? (
                <Text style={styles.customerPhone}>
                  {t.sellerDlNumber}: {receipt.seller_dl_number}
                  {receipt.seller_state_of_issue
                    ? ` (${receipt.seller_state_of_issue})`
                    : ''}
                </Text>
              ) : null}
              {receipt.seller_dob ? (
                <Text style={styles.customerPhone}>
                  {t.sellerDateOfBirth}: {receipt.seller_dob}
                </Text>
              ) : null}
              {receipt.seller_address ? (
                <Text style={styles.customerPhone}>
                  {[
                    receipt.seller_address,
                    receipt.seller_city,
                    receipt.seller_state
                      ? `${receipt.seller_state} ${receipt.seller_zip ?? ''}`
                      : receipt.seller_zip,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              ) : null}
            </Section>
          ) : null}

          {/* Vehicle Info */}
          {(receipt.vehicle_plate || receipt.vehicle_year) && (
            <Section title={t.vehicleInfo}>
              {receipt.vehicle_plate ? (
                <Text style={styles.customerPhone}>
                  {t.vehiclePlate}: {receipt.vehicle_plate}
                </Text>
              ) : null}
              {(receipt.vehicle_year ||
                receipt.vehicle_make ||
                receipt.vehicle_model) && (
                <Text style={styles.customerPhone}>
                  {[
                    receipt.vehicle_year,
                    receipt.vehicle_make,
                    receipt.vehicle_model,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </Text>
              )}
              {receipt.vehicle_color ? (
                <Text style={styles.customerPhone}>
                  {t.vehicleColor}: {receipt.vehicle_color}
                </Text>
              ) : null}
            </Section>
          )}

          {/* Catalytic Converter Info */}
          {(receipt.cat_converter_numbers || receipt.transport_vin) && (
            <Section title={t.catConverterSection}>
              {receipt.cat_converter_numbers ? (
                <Text style={styles.customerPhone}>
                  {t.catConverterNumbers}: {receipt.cat_converter_numbers}
                </Text>
              ) : null}
              {receipt.transport_vin ? (
                <Text style={styles.customerPhone}>
                  {t.transportVin}: {receipt.transport_vin}
                </Text>
              ) : null}
              {receipt.cat_converter_photo_uri ? (
                <View style={styles.photoBox}>
                  <SignedImage
                    value={receipt.cat_converter_photo_uri}
                    style={styles.photo}
                    resizeMode="contain"
                  />
                </View>
              ) : null}
              {receipt.cat_title_photo_uri ? (
                <View style={styles.photoBox}>
                  <SignedImage
                    value={receipt.cat_title_photo_uri}
                    style={styles.photo}
                    resizeMode="contain"
                  />
                </View>
              ) : null}
            </Section>
          )}

          {/* Seller & material photos (NM 57-30-5(C)) */}
          {(receipt.seller_photo_uri || receipt.material_photo_uri) && (
            <Section title={t.sellerIdInfo}>
              {receipt.seller_photo_uri ? (
                <>
                  <Text style={styles.customerPhone}>{t.sellerPhoto}</Text>
                  <View style={styles.photoBox}>
                    <SignedImage
                      value={receipt.seller_photo_uri}
                      style={styles.photo}
                      resizeMode="contain"
                    />
                  </View>
                </>
              ) : null}
              {receipt.material_photo_uri ? (
                <>
                  <Text style={styles.customerPhone}>{t.materialPhoto}</Text>
                  <View style={styles.photoBox}>
                    <SignedImage
                      value={receipt.material_photo_uri}
                      style={styles.photo}
                      resizeMode="contain"
                    />
                  </View>
                </>
              ) : null}
            </Section>
          )}

          {/* Signature */}
          {receipt.signature_uri && (
            <Section title={t.customerSignature}>
              <View style={styles.signatureBox}>
                <Image
                  source={{ uri: receipt.signature_uri }}
                  style={styles.signatureImage}
                  resizeMode="contain"
                />
              </View>
            </Section>
          )}

          {/* Statutory-locked footer note */}
          <View style={styles.statutoryNote}>
            <Ionicons
              name="lock-closed"
              size={11}
              color={colors.textTertiary}
            />
            <Text style={styles.statutoryText}>{t.statutoryLocked}</Text>
          </View>

          {/* Secondary actions (preserved) — NM forms, share, dispose, delete */}
          {receipt.seller_name ? (
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={async () => {
                  try {
                    await printNmPurchaseRecord(receipt);
                  } catch (err) {
                    Alert.alert(t.error, (err as Error).message);
                  }
                }}
              >
                <Text style={styles.secondaryButtonText}>{t.printNmForms}</Text>
              </TouchableOpacity>
              {(receipt.cat_converter_numbers || receipt.transport_vin) && (
                <TouchableOpacity
                  style={[styles.secondaryButton, { marginTop: spacing.sm }]}
                  onPress={async () => {
                    try {
                      await printNmCatConverterForm(receipt);
                    } catch (err) {
                      Alert.alert(t.error, (err as Error).message);
                    }
                  }}
                >
                  <Text style={styles.secondaryButtonText}>
                    {t.catConverterSection}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          <TouchableOpacity style={styles.shareLink} onPress={handleShare}>
            <Ionicons
              name="share-outline"
              size={16}
              color={colors.textSecondary}
            />
            <Text style={styles.shareLinkText}>{t.shareReceipt}</Text>
          </TouchableOpacity>

          {/* Mark material disposed (only once the mandatory hold has elapsed) */}
          {receipt.hold_until && !receipt.disposed_at && (
            <TouchableOpacity
              style={styles.disposeButton}
              onPress={async () => {
                const heldUntil = receipt.hold_until
                  ? new Date(receipt.hold_until)
                  : null;
                if (heldUntil && heldUntil > new Date()) {
                  Alert.alert(
                    t.materialOnHold,
                    `${t.holdUntil}: ${heldUntil.toLocaleDateString()}`
                  );
                  return;
                }
                if (!(await ensureElevated())) return;
                try {
                  await markReceiptDisposed(receiptId);
                  Alert.alert(t.success, t.materialDisposed);
                  const updated = await fetchReceiptById(receiptId);
                  setReceipt(updated as ReceiptDetail);
                } catch (err) {
                  Alert.alert(t.error, (err as Error).message);
                }
              }}
            >
              <Text style={styles.disposeButtonText}>{t.markDisposed}</Text>
            </TouchableOpacity>
          )}

          {/* Delete */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert(t.deleteReceipt, t.deleteReceiptConfirm, [
                { text: t.cancel, style: 'cancel' },
                {
                  text: t.deleteReceipt,
                  style: 'destructive',
                  onPress: async () => {
                    if (!(await ensureElevated())) return;
                    try {
                      await deleteReceipt(receiptId);
                      Alert.alert(t.success, t.receiptDeleted);
                      navigation.goBack();
                    } catch (err) {
                      Alert.alert(t.error, (err as Error).message);
                    }
                  },
                },
              ]);
            }}
          >
            <Text style={styles.deleteButtonText}>{t.deleteReceipt}</Text>
          </TouchableOpacity>
        </ResponsiveContainer>
      </ScrollView>

      {/* Footer: Reprint + Done */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.reprintButton}
          onPress={() => handlePrint()}
        >
          <Ionicons name="print-outline" size={18} color={colors.textPrimary} />
          <Text style={styles.reprintButtonText}>{t.reprint}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneButtonText}>{t.done}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
      fontFamily: fonts.sans,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xl,
    },

    // Hero block
    heroBlock: {
      alignItems: 'center',
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
    heroNo: {
      color: colors.textTertiary,
      fontSize: fontSize.md,
      fontFamily: fonts.mono,
      letterSpacing: 0.5,
    },
    heroTotal: {
      color: colors.accent,
      fontSize: 40,
      fontFamily: fonts.display,
      letterSpacing: -1,
      marginVertical: spacing.xs,
    },
    heroMeta: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.mono,
    },

    // Notices
    restrictedNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: 'rgba(181, 70, 47, 0.10)',
      borderWidth: 1,
      borderColor: 'rgba(181, 70, 47, 0.28)',
      marginBottom: spacing.md,
    },
    holdNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    noticeText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: fonts.sans,
      lineHeight: 17,
    },

    // Detail table
    detailTable: {
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      marginBottom: spacing.xl,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailRowLast: {
      borderBottomWidth: 0,
    },
    detailKey: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sans,
    },
    detailVal: {
      color: colors.textPrimary,
      fontSize: fontSize.sm,
      fontFamily: fonts.monoSemiBold,
    },

    // Sections
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.monoSemiBold,
      marginBottom: spacing.sm,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    customerName: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sans,
    },
    customerPhone: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      marginTop: spacing.xs,
    },

    // Line items
    lineItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    lineItemLeft: {
      flex: 1,
    },
    lineItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    metalName: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansSemiBold,
    },
    overrideBadge: {
      backgroundColor: 'rgba(181, 70, 47, 0.15)',
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: borderRadius.sm,
    },
    overrideBadgeText: {
      color: colors.danger,
      fontSize: fontSize.xs,
      fontFamily: fonts.sansBold,
    },
    lineItemDetail: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sans,
      marginTop: spacing.xs,
    },
    tareDetail: {
      color: colors.textTertiary,
      fontSize: fontSize.xs,
      fontFamily: fonts.sans,
      marginTop: spacing.xs,
    },
    originalPrice: {
      color: colors.textTertiary,
      fontSize: fontSize.xs,
      fontFamily: fonts.mono,
      textDecorationLine: 'line-through',
      marginTop: 2,
    },
    lineItemTotal: {
      color: colors.accent,
      fontSize: fontSize.lg,
      fontFamily: fonts.monoSemiBold,
      marginLeft: spacing.md,
    },

    // Photos & signature
    photoBox: {
      borderRadius: borderRadius.md,
      overflow: 'hidden',
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    photo: {
      width: '100%',
      height: 180,
      backgroundColor: colors.surface,
    },
    signatureBox: {
      backgroundColor: '#ffffff',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      alignItems: 'center',
    },
    signatureImage: {
      width: '100%',
      height: 120,
    },

    // Statutory note
    statutoryNote: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      marginTop: spacing.xs,
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
    },
    statutoryText: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.mono,
      letterSpacing: 0.3,
      lineHeight: 14,
      textAlign: 'center',
      flexShrink: 1,
    },

    // Secondary actions
    secondaryRow: {
      marginBottom: spacing.md,
    },
    secondaryButton: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.gold + '1a',
    },
    secondaryButtonText: {
      color: colors.warning,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
    shareLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.md,
      marginBottom: spacing.sm,
    },
    shareLinkText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    disposeButton: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.gold,
      marginBottom: spacing.md,
    },
    disposeButtonText: {
      color: colors.gold,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    deleteButton: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.danger,
      marginBottom: spacing.lg,
    },
    deleteButtonText: {
      color: colors.danger,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },

    // Footer
    footer: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    reprintButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    reprintButtonText: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansSemiBold,
    },
    doneButton: {
      flex: 1,
      padding: spacing.lg,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    doneButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
  });
