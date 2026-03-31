import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useState, useRef, useCallback } from 'react';
import {
  AccessCodeModal,
  SignaturePad,
  AddLineItemModal,
} from '../../components';
import type { SignaturePadHandle } from '../../components/SignaturePad';
import { useT } from '../../hooks/useT';
import { useNewTransaction } from '../../hooks/useNewTransaction';
import { searchCustomers, type Customer } from '../../services/customers';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'NewTransaction'
>;

interface SavedReceipt {
  id: string;
  total: number;
  customerName: string;
  itemCount: number;
}

export default function NewTransactionScreen({ navigation }: Props) {
  const { t } = useT();
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const tx = useNewTransaction(signaturePadRef);
  const [printAfterSave, setPrintAfterSave] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState<SavedReceipt | null>(null);
  const [customerResults, setCustomers] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | undefined
  >();

  const handleCustomerSearch = useCallback(async () => {
    const query = tx.customerName.trim();
    if (!query) return;
    setSearchingCustomers(true);
    try {
      const results = await searchCustomers(query);
      setCustomers(results);
      setShowCustomers(true);
    } catch {
      // silently fail — user can still type manually
    } finally {
      setSearchingCustomers(false);
    }
  }, [tx.customerName]);

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      tx.setCustomerName(customer.name);
      tx.setCustomerPhone(customer.phone ?? '');
      setSelectedCustomerId(customer.id);
      setShowCustomers(false);
      setCustomers([]);
    },
    [tx]
  );

  const handleSaveSuccess = useCallback(
    (receiptId: string) => {
      if (printAfterSave) {
        // Go straight to receipt detail with print
        tx.resetForm();
        navigation.replace('ReceiptDetail', {
          receiptId,
          printOnLoad: true,
        });
      } else {
        setSavedReceipt({
          id: receiptId,
          total: tx.receiptTotal,
          customerName: tx.customerName,
          itemCount: tx.lineItems.length,
        });
      }
    },
    [printAfterSave, tx, navigation]
  );

  const handleNewTicket = useCallback(
    (keepCustomer: boolean) => {
      tx.resetForm(keepCustomer);
      setSavedReceipt(null);
    },
    [tx]
  );

  const handleViewReceipt = useCallback(() => {
    if (!savedReceipt) return;
    const receiptId = savedReceipt.id;
    setSavedReceipt(null);
    tx.resetForm();
    navigation.replace('ReceiptDetail', {
      receiptId,
      printOnLoad: printAfterSave,
    });
  }, [savedReceipt, navigation, printAfterSave, tx]);

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>{t.customerInfo}</Text>
        <View style={styles.customerSearchRow}>
          <TextInput
            style={[styles.input, styles.customerNameInput]}
            placeholder={`${t.customerName} *`}
            placeholderTextColor={colors.textTertiary}
            value={tx.customerName}
            onChangeText={(text) => {
              tx.setCustomerName(text);
              setSelectedCustomerId(undefined);
              if (showCustomers) setShowCustomers(false);
            }}
            onSubmitEditing={handleCustomerSearch}
            returnKeyType="search"
          />
          <TouchableOpacity
            style={styles.customerSearchButton}
            onPress={handleCustomerSearch}
            disabled={searchingCustomers || !tx.customerName.trim()}
          >
            {searchingCustomers ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.customerSearchButtonText}>{t.search}</Text>
            )}
          </TouchableOpacity>
        </View>
        {showCustomers && (
          <View style={styles.customerResultsContainer}>
            {customerResults.length === 0 ? (
              <Text style={styles.noCustomersText}>{t.noCustomersFound}</Text>
            ) : (
              customerResults.map((c, i) => (
                <TouchableOpacity
                  key={`${c.id}-${i}`}
                  style={styles.customerResultRow}
                  onPress={() => handleSelectCustomer(c)}
                >
                  <Text style={styles.customerResultName}>{c.name}</Text>
                  <View style={styles.customerResultDetails}>
                    {c.phone ? (
                      <Text style={styles.customerResultPhone}>{c.phone}</Text>
                    ) : null}
                    {c.drivers_license ? (
                      <Text style={styles.customerResultDl}>
                        {t.dlNumberShort} {c.drivers_license}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
        <TextInput
          style={styles.input}
          placeholder={t.phoneNumber}
          placeholderTextColor={colors.textTertiary}
          value={tx.customerPhone}
          onChangeText={tx.setCustomerPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.sectionTitle}>{t.vehicleInfo}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.vehiclePlate}
          placeholderTextColor={colors.textTertiary}
          value={tx.vehiclePlate}
          onChangeText={tx.setVehiclePlate}
          autoCapitalize="characters"
        />
        <TextInput
          style={styles.input}
          placeholder={t.vehicleDescription}
          placeholderTextColor={colors.textTertiary}
          value={tx.vehicleDescription}
          onChangeText={tx.setVehicleDescription}
        />

        <TouchableOpacity
          style={styles.addLineItemButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addLineItemButtonText}>{t.addLineItem}</Text>
        </TouchableOpacity>

        {tx.lineItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t.lineItems}</Text>
            <Text style={styles.hintText}>{t.tapPriceToOverride}</Text>
            {tx.lineItems.map((item, index) => (
              <View key={index} style={styles.lineItemRow}>
                <View style={styles.lineItemInfo}>
                  <View style={styles.lineItemHeader}>
                    <Text style={styles.lineItemName}>{item.metalName}</Text>
                    {item.isPriceOverride && (
                      <Text style={styles.overrideBadge}>{t.override}</Text>
                    )}
                  </View>

                  {tx.editingIndex === index ? (
                    <View style={styles.editPriceRow}>
                      <Text style={styles.editPriceLabel}>{t.pricePerLb}</Text>
                      <TextInput
                        style={styles.editPriceInput}
                        value={tx.overridePrice}
                        onChangeText={tx.setOverridePrice}
                        keyboardType="decimal-pad"
                        autoFocus
                      />
                      <TouchableOpacity
                        style={styles.editPriceConfirm}
                        onPress={() => tx.requestOverride(index)}
                      >
                        <Text style={styles.editPriceConfirmText}>OK</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editPriceCancel}
                        onPress={tx.cancelEdit}
                      >
                        <Text style={styles.editPriceCancelText}>X</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => tx.startPriceEdit(index)}>
                      <Text style={styles.lineItemDetail}>
                        {Number(item.weight).toFixed(2)} lbs @{' '}
                        <Text
                          style={
                            item.isPriceOverride
                              ? styles.overridePrice
                              : undefined
                          }
                        >
                          ${Number(item.pricePerLb).toFixed(4)}/lb
                        </Text>
                        {item.isPriceOverride && (
                          <Text style={styles.originalPrice}>
                            {' '}
                            (was ${Number(item.originalPricePerLb).toFixed(4)}
                            /lb)
                          </Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.lineItemTotal}>
                  ${item.total.toFixed(2)}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(t.removeItem, t.removeItemConfirm, [
                      { text: t.cancel, style: 'cancel' },
                      {
                        text: t.remove,
                        style: 'destructive',
                        onPress: () => tx.removeLineItem(index),
                      },
                    ])
                  }
                  style={styles.removeButton}
                >
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.receiptTotal}</Text>
          <Text style={styles.totalValue}>${tx.receiptTotal.toFixed(2)}</Text>
        </View>

        {/* Seller Affirmation */}
        <TouchableOpacity
          style={styles.affirmationRow}
          onPress={() => tx.setSellerAffirmed(!tx.sellerAffirmed)}
        >
          <View
            style={[
              styles.checkbox,
              tx.sellerAffirmed && styles.checkboxChecked,
            ]}
          >
            {tx.sellerAffirmed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.affirmationText}>{t.sellerAffirmation}</Text>
        </TouchableOpacity>

        {tx.hasRestrictedMetal && (
          <View style={styles.restrictedBanner}>
            <Text style={styles.restrictedBannerText}>
              {t.restrictedWarning}
            </Text>
          </View>
        )}

        <SignaturePad
          ref={signaturePadRef}
          onSignatureChange={tx.setSignature}
          label={t.customerSignature}
          clearLabel={t.clear}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              styles.saveButtonOutline,
              (tx.lineItems.length === 0 || tx.saving) &&
                styles.saveButtonDisabled,
            ]}
            onPress={() => {
              setPrintAfterSave(false);
              tx.saveReceipt(handleSaveSuccess, selectedCustomerId);
            }}
            disabled={tx.lineItems.length === 0 || tx.saving}
          >
            {tx.saving && !printAfterSave ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.saveButtonOutlineText}>{t.saveReceipt}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              styles.saveButtonPrimary,
              (tx.lineItems.length === 0 || tx.saving) &&
                styles.saveButtonDisabled,
            ]}
            onPress={() => {
              setPrintAfterSave(true);
              tx.saveReceipt(handleSaveSuccess, selectedCustomerId);
            }}
            disabled={tx.lineItems.length === 0 || tx.saving}
          >
            {tx.saving && printAfterSave ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>{t.saveAndPrint}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Quick-mode success modal */}
      <Modal
        visible={!!savedReceipt}
        transparent
        animationType="fade"
        onRequestClose={handleViewReceipt}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconCircle}>
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.successTitle}>{t.receiptSaved}</Text>
            {savedReceipt && (
              <View style={styles.successSummary}>
                <Text style={styles.successCustomer}>
                  {savedReceipt.customerName}
                </Text>
                <Text style={styles.successDetail}>
                  {savedReceipt.itemCount}{' '}
                  {savedReceipt.itemCount === 1 ? 'item' : t.items} — $
                  {savedReceipt.total.toFixed(2)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.quickModeButton}
              onPress={() => handleNewTicket(false)}
            >
              <Text style={styles.quickModeButtonText}>{t.newTicket}</Text>
            </TouchableOpacity>
            {savedReceipt && (
              <TouchableOpacity
                style={styles.quickModeSameCustomer}
                onPress={() => handleNewTicket(true)}
              >
                <Text style={styles.quickModeSameCustomerText}>
                  {t.newTicketSameCustomer}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewReceiptButton}
              onPress={handleViewReceipt}
            >
              <Text style={styles.viewReceiptButtonText}>{t.viewReceipt}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AccessCodeModal
        visible={tx.showCodeModal}
        onSuccess={tx.approveOverride}
        onCancel={tx.cancelOverride}
      />

      <AddLineItemModal
        visible={showAddModal}
        onAdd={(metal, weight, weightData) => {
          tx.addLineItem(metal, weight, weightData);
          setShowAddModal(false);
        }}
        onClose={() => setShowAddModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  hintText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
    marginTop: -spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: fontSize.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  customerSearchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  customerNameInput: {
    flex: 1,
  },
  customerSearchButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    marginBottom: spacing.md,
  },
  customerSearchButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  customerResultsContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    maxHeight: 200,
  },
  customerResultRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  customerResultName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  customerResultDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  customerResultPhone: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  customerResultDl: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
  noCustomersText: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    padding: spacing.md,
    textAlign: 'center',
  },
  addLineItemButton: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  addLineItemButtonText: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineItemName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  overrideBadge: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontWeight: '700',
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  lineItemDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  overridePrice: {
    color: colors.danger,
    fontWeight: 'bold',
  },
  originalPrice: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    textDecorationLine: 'line-through',
  },
  editPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  editPriceLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  editPriceInput: {
    backgroundColor: colors.background,
    color: colors.textPrimary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.accent,
    minWidth: 80,
  },
  editPriceConfirm: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editPriceConfirmText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fontSize.sm,
  },
  editPriceCancel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editPriceCancelText: {
    color: colors.textSecondary,
    fontWeight: 'bold',
    fontSize: fontSize.sm,
  },
  lineItemTotal: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginRight: spacing.md,
  },
  removeButton: {
    padding: spacing.sm,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginVertical: spacing.lg,
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
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  saveButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  saveButtonPrimary: {
    backgroundColor: colors.accent,
  },
  saveButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  saveButtonOutlineText: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  successModal: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  successTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  successSummary: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successCustomer: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  successDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginTop: spacing.xs,
  },
  quickModeButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickModeButtonText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  quickModeSameCustomer: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickModeSameCustomerText: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  viewReceiptButton: {
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  viewReceiptButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  affirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  affirmationText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    flex: 1,
  },
  restrictedBanner: {
    backgroundColor: 'rgba(210, 153, 34, 0.15)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  restrictedBannerText: {
    color: colors.warning,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
