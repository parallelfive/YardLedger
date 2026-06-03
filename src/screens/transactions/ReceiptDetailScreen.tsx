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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useT } from '../../hooks/useT';
import { fetchReceiptById, deleteReceipt } from '../../services/receipts';
import { AccessCodeModal } from '../../components';
import { printReceipt, shareReceipt } from '../../utils/printReceipt';
import {
  printNmPurchaseRecord,
  printNmCatConverterForm,
} from '../../utils/printNmForms';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

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
  cat_converter_numbers?: string;
  transport_vin?: string;
  cat_converter_photo_uri?: string | null;
  cat_title_photo_uri?: string | null;
  subtotal: number;
  signature_uri?: string | null;
  created_at: string;
  line_items: ReceiptLineItem[];
}

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'ReceiptDetail'
>;

export default function ReceiptDetailScreen({ route, navigation }: Props) {
  const { t } = useT();
  const { receiptId, printOnLoad } = route.params;
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteAuth, setShowDeleteAuth] = useState(false);

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

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.receiptNumber}>{receipt.receipt_number}</Text>
          <Text style={styles.date}>
            {new Date(receipt.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.customer}</Text>
          <Text style={styles.customerName}>{receipt.customer_name}</Text>
          {receipt.customer_phone ? (
            <Text style={styles.customerPhone}>{receipt.customer_phone}</Text>
          ) : null}
        </View>

        {/* Seller ID — regulated materials */}
        {receipt.seller_name ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.sellerIdInfo}</Text>
            {receipt.seller_id_photo_uri ? (
              <View style={styles.sellerIdPhotoBox}>
                <Image
                  source={{ uri: receipt.seller_id_photo_uri }}
                  style={styles.sellerIdPhoto}
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
          </View>
        ) : null}

        {/* Vehicle Info */}
        {(receipt.vehicle_plate || receipt.vehicle_year) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.vehicleInfo}</Text>
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
          </View>
        )}

        {/* Catalytic Converter Info */}
        {(receipt.cat_converter_numbers || receipt.transport_vin) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.catConverterSection}</Text>
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
              <View style={styles.sellerIdPhotoBox}>
                <Image
                  source={{ uri: receipt.cat_converter_photo_uri }}
                  style={styles.sellerIdPhoto}
                  resizeMode="contain"
                />
              </View>
            ) : null}
            {receipt.cat_title_photo_uri ? (
              <View style={styles.sellerIdPhotoBox}>
                <Image
                  source={{ uri: receipt.cat_title_photo_uri }}
                  style={styles.sellerIdPhoto}
                  resizeMode="contain"
                />
              </View>
            ) : null}
          </View>
        )}

        {/* Line Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t.items} ({lineItems.length})
          </Text>
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
                      {t.tareWeightLabel}: {Number(item.tare_weight).toFixed(2)}
                    </Text>
                    <Text style={styles.lineItemDetail}>
                      {t.netWeightResult} {Number(item.weight).toFixed(2)} lbs @
                      ${Number(item.price_per_lb).toFixed(4)}/lb
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
                ${Number(item.total).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.total}</Text>
          <Text style={styles.totalValue}>
            ${Number(receipt.subtotal).toFixed(2)}
          </Text>
        </View>

        {/* Signature */}
        {receipt.signature_uri && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.customerSignature}</Text>
            <View style={styles.signatureBox}>
              <Image
                source={{ uri: receipt.signature_uri }}
                style={styles.signatureImage}
                resizeMode="contain"
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Text style={styles.shareButtonText}>{t.shareReceipt}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.printButton}
          onPress={() => handlePrint()}
        >
          <Text style={styles.printButtonText}>{t.print}</Text>
        </TouchableOpacity>
      </View>
      {receipt.seller_name ? (
        <View style={styles.nmFormRow}>
          <TouchableOpacity
            style={styles.nmFormButton}
            onPress={async () => {
              try {
                await printNmPurchaseRecord(receipt);
              } catch (err) {
                Alert.alert(t.error, (err as Error).message);
              }
            }}
          >
            <Text style={styles.nmFormButtonText}>{t.printNmForms}</Text>
          </TouchableOpacity>
          {(receipt.cat_converter_numbers || receipt.transport_vin) && (
            <TouchableOpacity
              style={[styles.nmFormButton, { marginTop: spacing.sm }]}
              onPress={async () => {
                try {
                  await printNmCatConverterForm(receipt);
                } catch (err) {
                  Alert.alert(t.error, (err as Error).message);
                }
              }}
            >
              <Text style={styles.nmFormButtonText}>
                {t.catConverterSection}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Delete */}
      <View style={styles.deleteRow}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            Alert.alert(t.deleteReceipt, t.deleteReceiptConfirm, [
              { text: t.cancel, style: 'cancel' },
              {
                text: t.deleteReceipt,
                style: 'destructive',
                onPress: () => setShowDeleteAuth(true),
              },
            ]);
          }}
        >
          <Text style={styles.deleteButtonText}>{t.deleteReceipt}</Text>
        </TouchableOpacity>
      </View>

      <AccessCodeModal
        visible={showDeleteAuth}
        onSuccess={async () => {
          setShowDeleteAuth(false);
          try {
            await deleteReceipt(receiptId);
            Alert.alert(t.success, t.receiptDeleted);
            navigation.goBack();
          } catch (err) {
            Alert.alert(t.error, (err as Error).message);
          }
        }}
        onCancel={() => setShowDeleteAuth(false)}
      />
    </View>
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
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  receiptNumber: {
    color: colors.accent,
    fontSize: fontSize.xxl,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  date: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  customerName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  customerPhone: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
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
    fontWeight: '600',
  },
  overrideBadge: {
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  overrideBadgeText: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: 'bold',
  },
  lineItemDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  tareDetail: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  originalPrice: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  lineItemTotal: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.xl,
  },
  totalValue: {
    color: colors.accent,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  sellerIdPhotoBox: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  sellerIdPhoto: {
    width: '100%',
    height: 180,
    backgroundColor: colors.card,
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
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    margin: spacing.lg,
  },
  shareButton: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  shareButtonText: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  printButton: {
    flex: 1,
    backgroundColor: colors.accent,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  printButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  nmFormRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  nmFormButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: 'rgba(210, 153, 34, 0.1)',
  },
  nmFormButtonText: {
    color: colors.warning,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  deleteRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  deleteButton: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
