import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SalesStackParamList } from '../../navigation/MainNavigator';
import { useT } from '../../hooks/useT';
import { useAppSelector, type RootState } from '../../store';
import { fetchInventory } from '../../services/inventory';
import { createSale } from '../../services/sales';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

interface InventoryItem {
  id: string;
  metal_id: string;
  metal_name: string;
  weight: number;
  avg_cost_per_lb: number;
}

interface SaleLineItem {
  metalId: string;
  metalName: string;
  weight: number;
  salePricePerLb: number;
  costBasisPerLb: number;
  revenue: number;
  profit: number;
}

type Props = NativeStackScreenProps<SalesStackParamList, 'NewSale'>;

export default function NewSaleScreen({ navigation }: Props) {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);

  const [buyerName, setBuyerName] = useState('');
  const [lineItems, setLineItems] = useState<SaleLineItem[]>([]);
  const [saving, setSaving] = useState(false);

  // Add line item state
  const [showPicker, setShowPicker] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [saleWeight, setSaleWeight] = useState('');
  const [salePrice, setSalePrice] = useState('');

  const totalRevenue = lineItems.reduce((sum, item) => sum + item.revenue, 0);
  const totalProfit = lineItems.reduce((sum, item) => sum + item.profit, 0);

  const openPicker = async () => {
    setLoadingInventory(true);
    setShowPicker(true);
    try {
      const data = await fetchInventory();
      // Only show items with stock > 0
      setInventory(
        (data ?? []).filter((item: InventoryItem) => Number(item.weight) > 0)
      );
    } catch {
      // Will show empty
    } finally {
      setLoadingInventory(false);
    }
  };

  const selectInventoryItem = (item: InventoryItem) => {
    setSelectedItem(item);
    setSaleWeight('');
    setSalePrice('');
  };

  const addLineItem = () => {
    if (!selectedItem) return;
    const weight = parseFloat(saleWeight);
    const price = parseFloat(salePrice);
    if (!weight || weight <= 0 || isNaN(weight)) {
      Alert.alert(t.error, t.enterValidWeight);
      return;
    }
    if (weight > Number(selectedItem.weight)) {
      Alert.alert(t.error, t.exceedsInventory);
      return;
    }
    if (!price || price <= 0 || isNaN(price)) {
      Alert.alert(t.error, t.enterValidPrice);
      return;
    }

    const costBasis = Number(selectedItem.avg_cost_per_lb);
    const revenue = weight * price;
    const profit = weight * (price - costBasis);

    setLineItems((prev) => [
      ...prev,
      {
        metalId: selectedItem.metal_id,
        metalName: selectedItem.metal_name,
        weight,
        salePricePerLb: price,
        costBasisPerLb: costBasis,
        revenue,
        profit,
      },
    ]);

    setSelectedItem(null);
    setSaleWeight('');
    setSalePrice('');
    setShowPicker(false);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelPicker = () => {
    setShowPicker(false);
    setSelectedItem(null);
    setSaleWeight('');
    setSalePrice('');
  };

  const handleSave = async () => {
    if (lineItems.length === 0) {
      Alert.alert(t.error, t.addAtLeastOneItem);
      return;
    }
    if (!profile) return;

    setSaving(true);
    try {
      for (const item of lineItems) {
        await createSale({
          metalId: item.metalId,
          metalName: item.metalName,
          weight: item.weight,
          salePricePerLb: item.salePricePerLb,
          costBasisPerLb: item.costBasisPerLb,
          buyerName: buyerName || undefined,
          workerId: profile.id,
        });
      }
      Alert.alert(t.success, t.saleSaved, [
        { text: t.ok, onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>{t.buyerInfo}</Text>
      <TextInput
        style={styles.input}
        placeholder={t.buyerName}
        placeholderTextColor={colors.textTertiary}
        value={buyerName}
        onChangeText={setBuyerName}
      />

      {/* Add Line Item */}
      {!showPicker ? (
        <TouchableOpacity style={styles.addLineItemButton} onPress={openPicker}>
          <Text style={styles.addLineItemButtonText}>{t.addLineItem}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.pickerContainer}>
          {!selectedItem ? (
            <>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{t.selectFromInventory}</Text>
                <TouchableOpacity onPress={cancelPicker}>
                  <Text style={styles.pickerCancel}>{t.cancel}</Text>
                </TouchableOpacity>
              </View>
              {loadingInventory ? (
                <ActivityIndicator
                  color={colors.accent}
                  style={styles.loader}
                />
              ) : inventory.length === 0 ? (
                <Text style={styles.emptyText}>{t.noInventory}</Text>
              ) : (
                inventory.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.inventoryRow}
                    onPress={() => selectInventoryItem(item)}
                  >
                    <View>
                      <Text style={styles.inventoryName}>
                        {item.metal_name}
                      </Text>
                      <Text style={styles.inventoryDetail}>
                        {Number(item.weight).toFixed(2)} lbs @ $
                        {Number(item.avg_cost_per_lb).toFixed(4)}
                        {t.perLb} {t.avgCost}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>{'>'}</Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : (
            <>
              <View style={styles.pickerHeader}>
                <TouchableOpacity onPress={() => setSelectedItem(null)}>
                  <Text style={styles.pickerBack}>{t.back}</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>
                  {selectedItem.metal_name}
                </Text>
                <TouchableOpacity onPress={cancelPicker}>
                  <Text style={styles.pickerCancel}>{t.cancel}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.inventoryHint}>
                {t.inStock}: {Number(selectedItem.weight).toFixed(2)} lbs
              </Text>
              <TextInput
                style={styles.input}
                placeholder={t.weightLbs}
                placeholderTextColor={colors.textTertiary}
                value={saleWeight}
                onChangeText={setSaleWeight}
                keyboardType="decimal-pad"
                autoFocus
              />
              <TextInput
                style={styles.input}
                placeholder={t.salePricePerLb}
                placeholderTextColor={colors.textTertiary}
                value={salePrice}
                onChangeText={setSalePrice}
                keyboardType="decimal-pad"
              />
              {saleWeight &&
                salePrice &&
                parseFloat(saleWeight) > 0 &&
                parseFloat(salePrice) > 0 && (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewLine}>
                      {t.revenue}: $
                      {(parseFloat(saleWeight) * parseFloat(salePrice)).toFixed(
                        2
                      )}
                    </Text>
                    <Text
                      style={[
                        styles.previewLine,
                        {
                          color:
                            parseFloat(salePrice) >
                            Number(selectedItem.avg_cost_per_lb)
                              ? colors.success
                              : colors.danger,
                        },
                      ]}
                    >
                      {t.profit}: $
                      {(
                        parseFloat(saleWeight) *
                        (parseFloat(salePrice) -
                          Number(selectedItem.avg_cost_per_lb))
                      ).toFixed(2)}
                    </Text>
                  </View>
                )}
              <TouchableOpacity style={styles.addButton} onPress={addLineItem}>
                <Text style={styles.addButtonText}>{t.addItem}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Line Items */}
      {lineItems.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t.lineItems}</Text>
          {lineItems.map((item, index) => (
            <View key={index} style={styles.lineItemRow}>
              <View style={styles.lineItemInfo}>
                <Text style={styles.lineItemName}>{item.metalName}</Text>
                <Text style={styles.lineItemDetail}>
                  {item.weight} lbs @ ${item.salePricePerLb.toFixed(4)}
                  {t.perLb}
                </Text>
                <Text
                  style={[
                    styles.lineItemProfit,
                    item.profit < 0 && styles.lineItemProfitNegative,
                  ]}
                >
                  {t.profit}: ${item.profit.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.lineItemRevenue}>
                ${item.revenue.toFixed(2)}
              </Text>
              <TouchableOpacity
                onPress={() => removeLineItem(index)}
                style={styles.removeButton}
              >
                <Text style={styles.removeButtonText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Totals */}
      {lineItems.length > 0 && (
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.revenue}:</Text>
            <Text style={styles.totalValue}>${totalRevenue.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.profit}:</Text>
            <Text
              style={[
                styles.totalProfit,
                totalProfit < 0 && styles.totalProfitNegative,
              ]}
            >
              ${totalProfit.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Save */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          (lineItems.length === 0 || saving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={lineItems.length === 0 || saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.saveButtonText}>{t.saveSale}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
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
  pickerContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pickerTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  pickerBack: {
    color: colors.accent,
    fontSize: fontSize.lg,
  },
  pickerCancel: {
    color: colors.danger,
    fontSize: fontSize.lg,
  },
  loader: {
    padding: spacing.lg,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    textAlign: 'center',
    padding: spacing.lg,
  },
  inventoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  inventoryName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  inventoryDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  chevron: {
    color: colors.textTertiary,
    fontSize: fontSize.xl,
  },
  inventoryHint: {
    color: colors.warning,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  previewCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  previewLine: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.background,
    fontSize: fontSize.lg,
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
  lineItemName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  lineItemDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  lineItemProfit: {
    color: colors.success,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  lineItemProfitNegative: {
    color: colors.danger,
  },
  lineItemRevenue: {
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
  totalsCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  totalProfit: {
    color: colors.success,
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  totalProfitNegative: {
    color: colors.danger,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
  bottomSpacer: {
    height: spacing.xxxl,
  },
});
