import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { Metal, MetalCategory } from '../../types';
import {
  fetchMetalCategories,
  fetchMetalsByCategory,
  createMetal,
  updateMetal,
  deactivateMetal,
  logPriceChange,
  fetchPriceHistory,
  type PriceHistoryEntry,
} from '../../services/metals';
import { useAppSelector, type RootState } from '../../store';
import { useT } from '../../hooks/useT';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

interface MetalSection {
  title: string;
  categoryId: string;
  data: Metal[];
}

type ModalMode = 'edit' | 'add' | null;

export default function PricingScreen() {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const [sections, setSections] = useState<MetalSection[]>([]);
  const [categories, setCategories] = useState<MetalCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingMetal, setEditingMetal] = useState<Metal | null>(null);
  const [newPrice, setNewPrice] = useState('');
  const [newName, setNewName] = useState('');
  const [isRestricted, setIsRestricted] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cats: MetalCategory[] = await fetchMetalCategories();
      setCategories(cats);
      const results: MetalSection[] = [];
      for (const cat of cats) {
        const metals = await fetchMetalsByCategory(cat.id);
        results.push({ title: cat.name, categoryId: cat.id, data: metals });
      }
      setSections(results);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t.error]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // --- Edit existing metal ---
  const openEdit = async (metal: Metal) => {
    setEditingMetal(metal);
    setNewPrice(metal.price_per_lb.toString());
    setNewName(metal.name);
    setIsRestricted(metal.is_restricted);
    setModalMode('edit');
    try {
      const history = await fetchPriceHistory(metal.id);
      setPriceHistory(history);
    } catch {
      setPriceHistory([]);
    }
  };

  // --- Add new metal ---
  const openAdd = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setNewName('');
    setNewPrice('');
    setModalMode('add');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingMetal(null);
    setNewPrice('');
    setNewName('');
    setIsRestricted(false);
    setSelectedCategoryId('');
    setPriceHistory([]);
  };

  const handleSaveEdit = async () => {
    if (!editingMetal || !profile) return;

    const price = parseFloat(newPrice);
    if (!price || price <= 0) {
      Alert.alert(t.error, t.enterValidPrice);
      return;
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      Alert.alert(t.error, t.enterMetalName);
      return;
    }

    const priceChanged = price !== editingMetal.price_per_lb;
    const nameChanged = trimmedName !== editingMetal.name;
    const restrictedChanged = isRestricted !== editingMetal.is_restricted;

    if (!priceChanged && !nameChanged && !restrictedChanged) {
      closeModal();
      return;
    }

    setSaving(true);
    try {
      const updates: {
        name?: string;
        price_per_lb?: number;
        is_restricted?: boolean;
      } = {};
      if (nameChanged) updates.name = trimmedName;
      if (priceChanged) updates.price_per_lb = price;
      if (restrictedChanged) updates.is_restricted = isRestricted;
      await updateMetal(editingMetal.id, updates, profile.id);
      if (priceChanged) {
        await logPriceChange(
          editingMetal.id,
          editingMetal.price_per_lb,
          price,
          profile.id
        );
      }
      Alert.alert(t.success, t.metalUpdated);
      closeModal();
      loadData();
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!profile) return;

    const trimmedName = newName.trim();
    if (!trimmedName) {
      Alert.alert(t.error, t.enterMetalName);
      return;
    }

    const price = parseFloat(newPrice);
    if (!price || price <= 0) {
      Alert.alert(t.error, t.enterValidPrice);
      return;
    }

    setSaving(true);
    try {
      await createMetal(trimmedName, price, selectedCategoryId);
      Alert.alert(t.success, t.metalAdded);
      closeModal();
      loadData();
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    if (!editingMetal) return;
    Alert.alert(t.removeMetal, t.removeMetalConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            await deactivateMetal(editingMetal.id);
            Alert.alert(t.success, t.metalRemoved);
            closeModal();
            loadData();
          } catch (err) {
            Alert.alert(t.error, (err as Error).message);
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadData}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openAdd(section.categoryId)}
            >
              <Text style={styles.addButtonText}>{t.addMetal}</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.metalRow}
            onPress={() => openEdit(item)}
          >
            <View style={styles.metalNameRow}>
              <Text style={styles.metalName}>{item.name}</Text>
              {item.is_restricted && (
                <View style={styles.restrictedBadge}>
                  <Text style={styles.restrictedBadgeText}>R</Text>
                </View>
              )}
            </View>
            <Text style={styles.metalPrice}>
              ${Number(item.price_per_lb).toFixed(4)}
              {t.perLb}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t.loading}</Text>
            </View>
          ) : null
        }
      />

      {/* Edit Metal Modal */}
      <Modal
        visible={modalMode === 'edit'}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.editMetal}</Text>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalCancel}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>

          {editingMetal && (
            <View style={styles.modalContent}>
              <Text style={styles.fieldLabel}>{t.metalName}</Text>
              <TextInput
                style={styles.textInput}
                value={newName}
                onChangeText={setNewName}
                placeholder={t.metalNamePlaceholder}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.fieldLabel}>{t.pricePerLb}</Text>
              <TextInput
                style={styles.priceInput}
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="decimal-pad"
              />

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.saveButtonText}>{t.save}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.restrictedToggle}
                onPress={() => setIsRestricted(!isRestricted)}
              >
                <View
                  style={[
                    styles.toggleBox,
                    isRestricted && styles.toggleBoxChecked,
                  ]}
                >
                  {isRestricted && <Text style={styles.toggleCheck}>✓</Text>}
                </View>
                <Text style={styles.restrictedToggleText}>
                  {t.restrictedMaterial}
                </Text>
              </TouchableOpacity>

              {priceHistory.length > 0 && (
                <View style={styles.historySection}>
                  <Text style={styles.historyTitle}>{t.priceHistory}</Text>
                  {priceHistory.map((h) => (
                    <View key={h.id} style={styles.historyRow}>
                      <Text style={styles.historyDate}>
                        {new Date(h.created_at).toLocaleDateString()}
                      </Text>
                      <Text style={styles.historyChange}>
                        ${Number(h.old_price).toFixed(4)} → $
                        {Number(h.new_price).toFixed(4)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.removeButton}
                onPress={handleRemove}
                disabled={saving}
              >
                <Text style={styles.removeButtonText}>{t.removeMetal}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* Add Metal Modal */}
      <Modal
        visible={modalMode === 'add'}
        animationType="slide"
        presentationStyle="formSheet"
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.newMetal}</Text>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalCancel}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.fieldLabel}>{t.selectCategoryForMetal}</Text>
            <View style={styles.categoryPicker}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    cat.id === selectedCategoryId &&
                      styles.categoryChipSelected,
                  ]}
                  onPress={() => setSelectedCategoryId(cat.id)}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      cat.id === selectedCategoryId &&
                        styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>{t.metalName}</Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t.metalNamePlaceholder}
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />

            <Text style={styles.fieldLabel}>{t.initialPrice}</Text>
            <TextInput
              style={styles.priceInput}
              value={newPrice}
              onChangeText={setNewPrice}
              keyboardType="decimal-pad"
              placeholder="0.0000"
              placeholderTextColor={colors.textSecondary}
            />

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.saveButtonText}>{t.addMetal}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.sansSemiBold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  addButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  addButtonText: {
    color: colors.accentInk,
    fontSize: fontSize.sm,
    fontFamily: fonts.sansSemiBold,
  },
  metalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sans,
    flex: 1,
  },
  metalPrice: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fonts.monoSemiBold,
  },
  empty: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sans,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
  modalCancel: {
    color: colors.danger,
    fontSize: fontSize.lg,
    fontFamily: fonts.sans,
  },
  modalContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
  },
  textInput: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: fontSize.lg,
    fontFamily: fonts.sans,
    borderWidth: 1,
    borderColor: colors.border,
  },
  priceInput: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: fontSize.xxl,
    fontFamily: fonts.mono,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.accentInk,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
  removeButton: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryChipText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
  categoryChipTextSelected: {
    color: colors.accentInk,
    fontFamily: fonts.sansSemiBold,
  },
  metalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  restrictedBadge: {
    backgroundColor: 'rgba(176, 138, 50, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  restrictedBadgeText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
  },
  restrictedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  toggleBox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleBoxChecked: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  toggleCheck: {
    color: colors.accentInk,
    fontSize: fontSize.sm,
    fontFamily: fonts.sansBold,
  },
  restrictedToggleText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
  },
  historySection: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansBold,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  historyDate: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
  historyChange: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
});
