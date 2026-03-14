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
import { colors, spacing, fontSize, borderRadius } from '../constants';

type Step = 'category' | 'metal' | 'weight';

interface AddLineItemModalProps {
  visible: boolean;
  onAdd: (metal: Metal, weight: number) => void;
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
    if (visible) {
      loadCategories();
    }
  }, [visible, loadCategories]);

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

  const handleAdd = () => {
    if (!selectedMetal) return;
    const w = parseFloat(weight);
    if (!w || w <= 0) return;
    onAdd(selectedMetal, w);
    handleReset();
  };

  const handleReset = () => {
    setStep('category');
    setSelectedCategory(null);
    setSelectedMetal(null);
    setMetals([]);
    setWeight('');
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
                        ${item.price_per_lb}/lb
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
              {selectedMetal.name} — ${selectedMetal.price_per_lb}/lb
            </Text>
            <TextInput
              style={styles.weightInput}
              placeholder={t.weightLbs}
              placeholderTextColor={colors.textTertiary}
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              autoFocus
            />
            {weight && parseFloat(weight) > 0 ? (
              <Text style={styles.preview}>
                {weight} lbs = $
                {(parseFloat(weight) * selectedMetal.price_per_lb).toFixed(2)}
              </Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.addButton,
                (!weight || parseFloat(weight) <= 0) &&
                  styles.addButtonDisabled,
              ]}
              onPress={handleAdd}
              disabled={!weight || parseFloat(weight) <= 0}
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
    fontWeight: '700',
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
    fontWeight: '600',
  },
  optionPrice: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
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
    fontWeight: '700',
    textAlign: 'center',
  },
  weightInput: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: fontSize.xxl,
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
    fontWeight: '700',
  },
});
