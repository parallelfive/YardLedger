import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useState, useRef } from 'react';
import {
  AccessCodeModal,
  SignaturePad,
  AddLineItemModal,
} from '../../components';
import type { SignaturePadHandle } from '../../components/SignaturePad';
import { useT } from '../../hooks/useT';
import { useNewTransaction } from '../../hooks/useNewTransaction';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'NewTransaction'
>;

export default function NewTransactionScreen({ navigation }: Props) {
  const { t } = useT();
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const tx = useNewTransaction(signaturePadRef);
  const [printAfterSave, setPrintAfterSave] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>{t.customerInfo}</Text>
        <TextInput
          style={styles.input}
          placeholder={`${t.customerName} *`}
          placeholderTextColor={colors.textTertiary}
          value={tx.customerName}
          onChangeText={tx.setCustomerName}
        />
        <TextInput
          style={styles.input}
          placeholder={t.phoneNumber}
          placeholderTextColor={colors.textTertiary}
          value={tx.customerPhone}
          onChangeText={tx.setCustomerPhone}
          keyboardType="phone-pad"
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
                        {item.weight} lbs @{' '}
                        <Text
                          style={
                            item.isPriceOverride
                              ? styles.overridePrice
                              : undefined
                          }
                        >
                          ${item.pricePerLb}/lb
                        </Text>
                        {item.isPriceOverride && (
                          <Text style={styles.originalPrice}>
                            {' '}
                            (was ${item.originalPricePerLb}/lb)
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
                  onPress={() => tx.removeLineItem(index)}
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
              tx.saveReceipt((receiptId) =>
                navigation.replace('ReceiptDetail', { receiptId })
              );
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
              tx.saveReceipt((receiptId) =>
                navigation.replace('ReceiptDetail', {
                  receiptId,
                  printOnLoad: true,
                })
              );
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

      <AccessCodeModal
        visible={tx.showCodeModal}
        onSuccess={tx.approveOverride}
        onCancel={tx.cancelOverride}
      />

      <AddLineItemModal
        visible={showAddModal}
        onAdd={(metal, weight) => {
          tx.addLineItem(metal, weight);
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
});
