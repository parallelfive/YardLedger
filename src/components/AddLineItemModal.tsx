import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import type { Metal, MetalCategory } from '../types';
import {
  fetchMetalCategories,
  fetchMetalsByCategory,
} from '../services/metals';
import { useT } from '../hooks/useT';
import { validateWeight } from '../utils/validation';
import { colors, spacing, fontSize, borderRadius, fonts } from '../constants';

// In-memory recent metals cache (persists for the app session)
const MAX_RECENT = 5;
let recentMetalsCache: Metal[] = [];

export function addToRecentMetals(metal: Metal) {
  recentMetalsCache = [
    metal,
    ...recentMetalsCache.filter((m) => m.id !== metal.id),
  ].slice(0, MAX_RECENT);
}

type Step = 'category' | 'metal' | 'weight';
type WeightMode = 'net' | 'tare';

interface WeightData {
  net: number;
  gross?: number;
  tare?: number;
}

interface AddLineItemModalProps {
  visible: boolean;
  onAdd: (metal: Metal, weight: number, weightData?: WeightData) => void;
  onClose: () => void;
}

export default function AddLineItemModal({
  visible,
  onAdd,
  onClose,
}: AddLineItemModalProps) {
  const { t } = useT();
  const [step, setStep] = useState<Step>('category');
  const [categories, setCategories] = useState<MetalCategory[]>([]);
  const [metals, setMetals] = useState<Metal[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingMetals, setLoadingMetals] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<MetalCategory | null>(null);
  const [selectedMetal, setSelectedMetal] = useState<Metal | null>(null);
  const [weight, setWeight] = useState('');
  const [weightMode, setWeightMode] = useState<WeightMode>('net');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');

  const loadCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const data = await fetchMetalCategories();
      setCategories(data);
    } catch {
      // Categories will be empty, user can retry
    } finally {
      setLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    if (visible && categories.length === 0) {
      loadCategories();
    }
  }, [visible, loadCategories, categories.length]);

  const handleSelectCategory = async (category: MetalCategory) => {
    setSelectedCategory(category);
    setLoadingMetals(true);
    try {
      const data = await fetchMetalsByCategory(category.id);
      setMetals(data);
      if (data.length === 1) {
        // Skip metal selection if only one metal in category
        setSelectedMetal(data[0]);
        setStep('weight');
      } else {
        setStep('metal');
      }
    } catch {
      // Metals will be empty
    } finally {
      setLoadingMetals(false);
    }
  };

  const handleSelectMetal = (metal: Metal) => {
    setSelectedMetal(metal);
    setStep('weight');
  };

  const parsedGross = validateWeight(grossWeight);
  const parsedTare = parseFloat(tareWeight) || 0;
  const netWeight =
    weightMode === 'net'
      ? (validateWeight(weight) ?? 0)
      : (parsedGross ?? 0) - parsedTare;

  const handleAdd = () => {
    if (!selectedMetal) return;
    if (weightMode === 'net') {
      if (validateWeight(weight) === null) return;
    } else {
      if (parsedGross === null) return;
      if (parsedTare < 0) return;
      if (netWeight <= 0) return;
    }
    const weightData: WeightData | undefined =
      weightMode === 'tare'
        ? {
            net: netWeight,
            gross: parsedGross ?? 0,
            tare: parsedTare,
          }
        : undefined;
    addToRecentMetals(selectedMetal);
    onAdd(selectedMetal, netWeight, weightData);
    handleReset();
  };

  const handleReset = () => {
    setStep('category');
    setSelectedCategory(null);
    setSelectedMetal(null);
    setMetals([]);
    setWeight('');
    setWeightMode('net');
    setGrossWeight('');
    setTareWeight('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleBack = () => {
    if (step === 'weight') {
      // If category had only 1 metal, go back to category
      if (metals.length <= 1) {
        setStep('category');
        setSelectedCategory(null);
        setSelectedMetal(null);
        setMetals([]);
      } else {
        setStep('metal');
        setSelectedMetal(null);
      }
      setWeight('');
      setGrossWeight('');
      setTareWeight('');
      setWeightMode('net');
    } else if (step === 'metal') {
      setStep('category');
      setSelectedCategory(null);
      setMetals([]);
    }
  };

  const renderStepIndicator = () => {
    const steps: Step[] = ['category', 'metal', 'weight'];
    const currentIndex = steps.indexOf(step);
    return (
      <View style={styles.stepIndicator}>
        {steps.map((s, i) => (
          <View
            key={s}
            style={[styles.stepDot, i <= currentIndex && styles.stepDotActive]}
          />
        ))}
      </View>
    );
  };

  const getTitle = () => {
    switch (step) {
      case 'category':
        return t.selectCategory;
      case 'metal':
        return selectedCategory?.name ?? t.selectMetal;
      case 'weight':
        return selectedMetal?.name ?? t.enterWeight;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {step !== 'category' ? (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>{t.back}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backButton} />
          )}
          <Text style={styles.title}>{getTitle()}</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>

        {renderStepIndicator()}

        {/* Step: Category */}
        {step === 'category' && (
          <>
            {loadingCategories ? (
              <ActivityIndicator
                color={colors.accent}
                size="large"
                style={styles.loader}
              />
            ) : (
              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                  recentMetalsCache.length > 0 ? (
                    <View style={styles.recentSection}>
                      <Text style={styles.recentTitle}>{t.recent}</Text>
                      {recentMetalsCache.map((metal) => (
                        <TouchableOpacity
                          key={metal.id}
                          style={styles.recentCard}
                          onPress={() => {
                            setSelectedMetal(metal);
                            setStep('weight');
                          }}
                        >
                          <View>
                            <Text style={styles.optionName}>{metal.name}</Text>
                            <Text style={styles.optionPrice}>
                              ${Number(metal.price_per_lb).toFixed(4)}/lb
                            </Text>
                          </View>
                          <Text style={styles.chevron}>{'>'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionCard}
                    onPress={() => handleSelectCategory(item)}
                  >
                    <Text style={styles.optionName}>{item.name}</Text>
                    <Text style={styles.chevron}>{'>'}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}

        {/* Step: Metal */}
        {step === 'metal' && (
          <>
            {loadingMetals ? (
              <ActivityIndicator
                color={colors.accent}
                size="large"
                style={styles.loader}
              />
            ) : (
              <FlatList
                data={metals}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionCard}
                    onPress={() => handleSelectMetal(item)}
                  >
                    <View>
                      <Text style={styles.optionName}>{item.name}</Text>
                      <Text style={styles.optionPrice}>
                        ${Number(item.price_per_lb).toFixed(4)}/lb
                      </Text>
                    </View>
                    <Text style={styles.chevron}>{'>'}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}

        {/* Step: Weight */}
        {step === 'weight' && selectedMetal && (
          <View style={styles.weightContainer}>
            <Text style={styles.metalInfo}>
              {selectedMetal.name} — $
              {Number(selectedMetal.price_per_lb).toFixed(4)}/lb
            </Text>

            {/* Weight mode toggle */}
            <View style={styles.weightModeToggle}>
              <TouchableOpacity
                style={[
                  styles.weightModeButton,
                  weightMode === 'net' && styles.weightModeButtonActive,
                ]}
                onPress={() => setWeightMode('net')}
              >
                <Text
                  style={[
                    styles.weightModeText,
                    weightMode === 'net' && styles.weightModeTextActive,
                  ]}
                >
                  {t.netWeight}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.weightModeButton,
                  weightMode === 'tare' && styles.weightModeButtonActive,
                ]}
                onPress={() => setWeightMode('tare')}
              >
                <Text
                  style={[
                    styles.weightModeText,
                    weightMode === 'tare' && styles.weightModeTextActive,
                  ]}
                >
                  {t.grossTare}
                </Text>
              </TouchableOpacity>
            </View>

            {weightMode === 'net' ? (
              <TextInput
                style={styles.weightInput}
                placeholder={t.weightLbs}
                placeholderTextColor={colors.textTertiary}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                autoFocus
              />
            ) : (
              <>
                <View style={styles.tareRow}>
                  <View style={styles.tareInputGroup}>
                    <Text style={styles.tareLabel}>{t.grossWeightLabel}</Text>
                    <TextInput
                      style={styles.weightInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      value={grossWeight}
                      onChangeText={setGrossWeight}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                  </View>
                  <Text style={styles.tareMinus}>−</Text>
                  <View style={styles.tareInputGroup}>
                    <Text style={styles.tareLabel}>{t.tareWeightLabel}</Text>
                    <TextInput
                      style={styles.weightInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textTertiary}
                      value={tareWeight}
                      onChangeText={setTareWeight}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                {netWeight > 0 && (
                  <View style={styles.netResult}>
                    <Text style={styles.netResultLabel}>
                      {t.netWeightResult}
                    </Text>
                    <Text style={styles.netResultValue}>
                      {netWeight.toFixed(2)} lbs
                    </Text>
                  </View>
                )}
              </>
            )}

            {netWeight > 0 ? (
              <Text style={styles.preview}>
                {netWeight.toFixed(2)} lbs = $
                {(netWeight * selectedMetal.price_per_lb).toFixed(2)}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.addButton,
                netWeight <= 0 && styles.addButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={netWeight <= 0}
            >
              <Text style={styles.addButtonText}>{t.addItem}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    minWidth: 60,
  },
  backButtonText: {
    color: colors.accent,
    fontSize: fontSize.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  closeButtonText: {
    color: colors.danger,
    fontSize: fontSize.lg,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.accent,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  recentSection: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  recentTitle: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
    marginBottom: spacing.xs,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 3,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  optionName: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansSemiBold,
  },
  optionPrice: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.mono,
    marginTop: spacing.xs,
  },
  chevron: {
    color: colors.textTertiary,
    fontSize: fontSize.xl,
  },
  weightContainer: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  metalInfo: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
    textAlign: 'center',
  },
  weightModeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  weightModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md - 2,
  },
  weightModeButtonActive: {
    backgroundColor: colors.accent,
  },
  weightModeText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.monoMedium,
  },
  weightModeTextActive: {
    color: colors.background,
  },
  tareRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  tareInputGroup: {
    flex: 1,
  },
  tareLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  tareMinus: {
    color: colors.textTertiary,
    fontSize: fontSize.xxl,
    fontFamily: fonts.sansBold,
    paddingBottom: spacing.md,
  },
  netResult: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 3,
  },
  netResultLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.lg,
  },
  netResultValue: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontFamily: fonts.monoSemiBold,
  },
  weightInput: {
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
  preview: {
    color: colors.textSecondary,
    fontSize: fontSize.xl,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
});
