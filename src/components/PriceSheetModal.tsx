import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import type { Metal, MetalCategory } from '../types';
import {
  fetchMetalCategories,
  fetchMetalsByCategory,
} from '../services/metals';
import { useT } from '../hooks/useT';
import { colors, spacing, fontSize, borderRadius, fonts } from '../constants';

interface MetalSection {
  title: string;
  data: Metal[];
}

interface PriceSheetModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PriceSheetModal({
  visible,
  onClose,
}: PriceSheetModalProps) {
  const { t } = useT();
  const [sections, setSections] = useState<MetalSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const categories: MetalCategory[] = await fetchMetalCategories();
      const results: MetalSection[] = [];
      for (const cat of categories) {
        const metals = await fetchMetalsByCategory(cat.id);
        if (metals.length > 0) {
          results.push({ title: cat.name, data: metals });
        }
      }
      setSections(results);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && sections.length === 0) {
      loadData();
    }
  }, [visible, loadData, sections.length]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.pricing}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{t.cancel}</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator
            color={colors.accent}
            size="large"
            style={styles.loader}
          />
        ) : loadError ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.error}</Text>
            <TouchableOpacity
              onPress={loadData}
              style={{ marginTop: spacing.md }}
            >
              <Text style={{ color: colors.accent, fontSize: fontSize.lg }}>
                {t.retry}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={styles.metalRow}>
                <Text style={styles.metalName}>{item.name}</Text>
                <Text style={styles.metalPrice}>
                  ${Number(item.price_per_lb).toFixed(4)}
                  {t.perLb}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>{t.noInventory}</Text>
              </View>
            }
          />
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
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
  closeButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  closeButtonText: {
    color: colors.danger,
    fontSize: fontSize.lg,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
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
  },
});
