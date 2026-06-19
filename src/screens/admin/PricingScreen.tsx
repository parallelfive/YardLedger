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
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { useAdminElevation } from '../../providers/AdminElevationProvider';
import { useT } from '../../hooks/useT';
import { MetalDot, fmtMoney, type Tone } from '../../components/foundry';
import { useTheme, useThemedStyles } from '../../theme';
import {
  type Palette,
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
type Tier = 'open' | 'regulated' | 'restricted' | 'catalytic';

// The three selectable compliance tiers (catalytic is intrinsic & locked).
const SELECTABLE_TIERS: Tier[] = ['open', 'regulated', 'restricted'];

// Derive the governing tier from the metal's compliance booleans (strictest
// wins). Catalytic is locked to the strictest tier by statute.
function metalTier(
  m: Pick<Metal, 'is_regulated' | 'is_restricted' | 'is_catalytic'>
): Tier {
  if (m.is_catalytic) return 'catalytic';
  if (m.is_restricted) return 'restricted';
  if (m.is_regulated) return 'regulated';
  return 'open';
}

function metalTone(category: string | undefined, tier: Tier): Tone {
  if (tier === 'restricted' || tier === 'catalytic') return 'rust';
  switch (category) {
    case 'Copper':
      return 'copper';
    case 'Brass':
      return 'gold';
    case 'Aluminum':
    case 'Steel':
      return 'steel';
    default:
      return 'ink3';
  }
}

export default function PricingScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const { ensureElevated } = useAdminElevation();
  const [sections, setSections] = useState<MetalSection[]>([]);
  const [categories, setCategories] = useState<MetalCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingMetal, setEditingMetal] = useState<Metal | null>(null);
  const [editingCategory, setEditingCategory] = useState<string | undefined>();
  const [newPrice, setNewPrice] = useState('');
  const [newName, setNewName] = useState('');
  const [tier, setTier] = useState<Tier>('open');
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
  const openEdit = async (metal: Metal, categoryName: string) => {
    setEditingMetal(metal);
    setEditingCategory(categoryName);
    setNewPrice(metal.price_per_lb.toString());
    setNewName(metal.name);
    setTier(metalTier(metal));
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
    setEditingCategory(undefined);
    setNewPrice('');
    setNewName('');
    setTier('open');
    setSelectedCategoryId('');
    setPriceHistory([]);
  };

  // The edit/add form is itself a Modal; iOS can't present the elevation PIN
  // Modal on top of it, so close this modal and let it finish dismissing before
  // prompting. Values are captured first since closeModal() clears form state.
  const dismissThenElevate = async (requireOwner = false): Promise<boolean> => {
    closeModal();
    await new Promise((r) => setTimeout(r, 350));
    return ensureElevated(requireOwner);
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
    const nextRestricted = tier === 'restricted';
    const restrictedChanged = nextRestricted !== editingMetal.is_restricted;

    if (!priceChanged && !nameChanged && !restrictedChanged) {
      closeModal();
      return;
    }

    // Capture before closing the modal (closeModal clears editingMetal/form).
    const metalId = editingMetal.id;
    const oldPrice = editingMetal.price_per_lb;
    const userId = profile.id;
    const updates: {
      name?: string;
      price_per_lb?: number;
      is_restricted?: boolean;
    } = {};
    if (nameChanged) updates.name = trimmedName;
    if (priceChanged) updates.price_per_lb = price;
    if (restrictedChanged) updates.is_restricted = nextRestricted;

    if (!(await dismissThenElevate())) return;
    setSaving(true);
    try {
      await updateMetal(metalId, updates, userId);
      if (priceChanged) {
        await logPriceChange(metalId, oldPrice, price, userId);
      }
      Alert.alert(t.success, t.metalUpdated);
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

    const categoryId = selectedCategoryId;
    if (!(await dismissThenElevate())) return;
    setSaving(true);
    try {
      await createMetal(trimmedName, price, categoryId);
      Alert.alert(t.success, t.metalAdded);
      loadData();
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = () => {
    if (!editingMetal) return;
    const metalId = editingMetal.id;
    Alert.alert(t.removeMetal, t.removeMetalConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          if (!(await dismissThenElevate())) return;
          setSaving(true);
          try {
            await deactivateMetal(metalId);
            Alert.alert(t.success, t.metalRemoved);
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

  const tierLabel = (tr: Tier): string => {
    switch (tr) {
      case 'open':
        return t.tierOpen;
      case 'regulated':
        return t.tierRegulated;
      case 'restricted':
        return t.tierRestricted;
      case 'catalytic':
        return t.tierCatalytic;
    }
  };

  const tierNote = (tr: Tier): string => {
    switch (tr) {
      case 'open':
        return t.tierOpenNote;
      case 'regulated':
        return t.tierRegulatedNote;
      case 'restricted':
        return t.tierRestrictedNote;
      case 'catalytic':
        return t.tierCatalyticNote;
    }
  };

  const editPrice = parseFloat(newPrice) || 0;
  const editDelta = editingMetal ? editPrice - editingMetal.price_per_lb : 0;
  const editCatalytic = editingMetal?.is_catalytic ?? false;

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        refreshing={loading}
        onRefresh={loadData}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Text style={styles.introNote}>{t.materialsManagerIntro}</Text>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => openAdd(section.categoryId)}
            >
              <Ionicons name="add" size={14} color={colors.accentInk} />
              <Text style={styles.addButtonText}>{t.addMetal}</Text>
            </TouchableOpacity>
          </View>
        )}
        renderItem={({ item, section }) => {
          const tr = metalTier(item);
          const tone = metalTone(section.title, tr);
          const c = colorForTier(tr, colors);
          return (
            <TouchableOpacity
              style={styles.metalRow}
              onPress={() => openEdit(item, section.title)}
              activeOpacity={0.7}
            >
              <MetalDot tone={tone} size={11} />
              <View style={styles.metalInfo}>
                <Text style={styles.metalName}>{item.name}</Text>
                <View style={styles.metalMetaRow}>
                  <View
                    style={[styles.tierPill, { backgroundColor: c + '20' }]}
                  >
                    <View style={[styles.tierDot, { backgroundColor: c }]} />
                    <Text style={[styles.tierPillText, { color: c }]}>
                      {tierLabel(tr)}
                    </Text>
                  </View>
                  <Text style={styles.metalCat}>{section.title}</Text>
                </View>
              </View>
              <View style={styles.metalRight}>
                <Text style={styles.metalPrice}>
                  {fmtMoney(Number(item.price_per_lb), 2)}
                </Text>
                <Text style={styles.metalPerLb}>{t.perLb}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={17}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          );
        }}
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
            <View>
              <Text style={styles.modalKicker}>{t.catalogKicker}</Text>
              <Text style={styles.modalTitle}>{t.editMetal}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {editingMetal && (
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
            >
              {/* identity */}
              <View style={styles.editIdentity}>
                <MetalDot
                  tone={metalTone(editingCategory, metalTier(editingMetal))}
                  size={13}
                />
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.editNameInput}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder={t.metalNamePlaceholder}
                    placeholderTextColor={colors.textTertiary}
                  />
                  {editingCategory ? (
                    <Text style={styles.editIdentitySub}>
                      {editingCategory}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* price */}
              <Text style={styles.fieldLabel}>{t.defaultPricePerLb}</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceField}>
                  <Text style={styles.priceSymbol}>$</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={newPrice}
                    onChangeText={setNewPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
                {editDelta !== 0 && (
                  <View style={styles.deltaCol}>
                    <Text
                      style={[
                        styles.deltaValue,
                        {
                          color: editDelta > 0 ? colors.moss : colors.rust,
                        },
                      ]}
                    >
                      {editDelta > 0 ? '+' : ''}
                      {fmtMoney(editDelta, 2)}
                    </Text>
                    <Text style={styles.deltaWas}>
                      {t.wasLabel}{' '}
                      {fmtMoney(Number(editingMetal.price_per_lb), 2)}
                    </Text>
                  </View>
                )}
              </View>

              {/* compliance tier */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
                {t.complianceTier}
              </Text>
              {editCatalytic ? (
                <View style={styles.lockBanner}>
                  <Ionicons name="lock-closed" size={17} color={colors.rust} />
                  <Text style={styles.lockBannerText}>
                    {t.catalyticLockedNote}
                  </Text>
                </View>
              ) : (
                <View style={styles.tierList}>
                  {SELECTABLE_TIERS.map((tr) => {
                    const c = colorForTier(tr, colors);
                    const sel = tier === tr;
                    return (
                      <TouchableOpacity
                        key={tr}
                        style={[
                          styles.tierOption,
                          {
                            borderColor: sel ? c : colors.border,
                            backgroundColor: sel ? c + '18' : colors.surface,
                          },
                        ]}
                        onPress={() => setTier(tr)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.radio,
                            {
                              borderColor: sel ? c : colors.borderStrong,
                              backgroundColor: sel ? c : 'transparent',
                            },
                          ]}
                        >
                          {sel && (
                            <Ionicons name="checkmark" size={13} color="#fff" />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.tierOptionLabel,
                              { color: sel ? c : colors.textPrimary },
                            ]}
                          >
                            {tierLabel(tr)}
                          </Text>
                          <Text style={styles.tierOptionNote}>
                            {tierNote(tr)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.accentInk} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.accentInk}
                    />
                    <Text style={styles.saveButtonText}>{t.save}</Text>
                  </>
                )}
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
                        {fmtMoney(Number(h.old_price), 2)} →{' '}
                        {fmtMoney(Number(h.new_price), 2)}
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
            </ScrollView>
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
            <View>
              <Text style={styles.modalKicker}>{t.catalogKicker}</Text>
              <Text style={styles.modalTitle}>{t.newMetal}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
              <Ionicons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
          >
            <Text style={styles.fieldLabel}>{t.selectCategoryForMetal}</Text>
            <View style={styles.categoryPicker}>
              {categories.map((cat) => {
                const sel = cat.id === selectedCategoryId;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      sel && styles.categoryChipSelected,
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        sel && styles.categoryChipTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              {t.metalName}
            </Text>
            <TextInput
              style={styles.textInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t.metalNamePlaceholder}
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
              {t.initialPrice}
            </Text>
            <View style={styles.priceField}>
              <Text style={styles.priceSymbol}>$</Text>
              <TextInput
                style={styles.priceInput}
                value={newPrice}
                onChangeText={setNewPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleAdd}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.accentInk} />
              ) : (
                <>
                  <Ionicons name="add" size={18} color={colors.accentInk} />
                  <Text style={styles.saveButtonText}>{t.addMetal}</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function colorForTier(tier: Tier, colors: Palette): string {
  switch (tier) {
    case 'open':
      return colors.moss;
    case 'regulated':
      return colors.gold;
    default:
      return colors.rust;
  }
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    introNote: {
      color: colors.textTertiary,
      fontSize: 12,
      fontFamily: fonts.mono,
      lineHeight: 18,
      marginBottom: spacing.md,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      backgroundColor: colors.background,
    },
    sectionTitle: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.md,
      paddingVertical: 5,
      borderRadius: borderRadius.pill,
    },
    addButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.xs,
      fontFamily: fonts.sansSemiBold,
    },
    metalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    metalInfo: { flex: 1, minWidth: 0 },
    metalName: {
      color: colors.textPrimary,
      fontSize: 14.5,
      fontFamily: fonts.sansSemiBold,
    },
    metalMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    tierPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: borderRadius.pill,
    },
    tierDot: { width: 5, height: 5, borderRadius: 99 },
    tierPillText: {
      fontSize: 9.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.3,
      textTransform: 'uppercase',
    },
    metalCat: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.mono,
    },
    metalRight: { alignItems: 'flex-end' },
    metalPrice: {
      color: colors.accent,
      fontSize: 15,
      fontFamily: fonts.monoSemiBold,
    },
    metalPerLb: {
      color: colors.textTertiary,
      fontSize: 9.5,
      fontFamily: fonts.mono,
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
    // ── modal ──
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalKicker: {
      color: colors.accent,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 22,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
      marginTop: 2,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalScroll: { flex: 1 },
    modalContent: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    editIdentity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    editNameInput: {
      color: colors.textPrimary,
      fontSize: 17,
      fontFamily: fonts.sansBold,
      padding: 0,
    },
    editIdentitySub: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
      marginTop: 2,
    },
    fieldLabel: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    priceField: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 12,
      paddingHorizontal: spacing.lg,
      borderRadius: 13,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
    },
    priceSymbol: {
      color: colors.textTertiary,
      fontSize: 22,
      fontFamily: fonts.display,
    },
    priceInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 26,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
      padding: 0,
    },
    deltaCol: { alignItems: 'flex-end' },
    deltaValue: {
      fontSize: 14,
      fontFamily: fonts.monoSemiBold,
    },
    deltaWas: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.mono,
      marginTop: 1,
    },
    lockBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 13,
      paddingHorizontal: spacing.lg,
      borderRadius: 13,
      backgroundColor: colors.rust + '14',
      borderWidth: 1,
      borderColor: colors.rust + '40',
    },
    lockBannerText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: fonts.sans,
      lineHeight: 17,
    },
    tierList: { gap: 7 },
    tierOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      borderRadius: 13,
      borderWidth: 1.5,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 99,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tierOptionLabel: {
      fontSize: 14,
      fontFamily: fonts.sansSemiBold,
    },
    tierOptionNote: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.mono,
      marginTop: 1,
      lineHeight: 14,
    },
    saveButton: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: 14,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xl,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.xl,
      fontFamily: fonts.sansBold,
    },
    removeButton: {
      borderRadius: 14,
      padding: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.danger,
      marginTop: spacing.lg,
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
    historySection: {
      marginTop: spacing.lg,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    historyTitle: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
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
      fontFamily: fonts.mono,
    },
    historyChange: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.mono,
    },
  });
