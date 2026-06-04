import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { Metal, MetalCategory } from '../../types';
import {
  fetchMetalCategories,
  fetchMetalsByCategory,
} from '../../services/metals';
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
  data: Metal[];
}

export default function MarketPricesScreen() {
  const { t } = useT();
  const [sections, setSections] = useState<MetalSection[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cats: MetalCategory[] = await fetchMetalCategories();
      const results: MetalSection[] = [];
      for (const cat of cats) {
        const metals = await fetchMetalsByCategory(cat.id);
        if (metals.length > 0) {
          results.push({ title: cat.name, data: metals });
        }
      }
      setSections(results);
    } catch {
      // Will show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <View style={styles.container}>
      {/* External price link */}
      <TouchableOpacity
        style={styles.linkCard}
        onPress={() =>
          Linking.openURL('https://www.scrapmonster.com/scrap-metal-prices')
        }
      >
        <Ionicons name="globe-outline" size={22} color={colors.accent} />
        <View style={styles.linkContent}>
          <Text style={styles.linkTitle}>{t.marketPrices}</Text>
          <Text style={styles.linkSub}>ScrapMonster.com</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkCard}
        onPress={() => Linking.openURL('https://iscrapapp.com/prices/')}
      >
        <Ionicons name="globe-outline" size={22} color={colors.teal} />
        <View style={styles.linkContent}>
          <Text style={styles.linkTitle}>iScrap App Prices</Text>
          <Text style={styles.linkSub}>iscrapapp.com</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={colors.textTertiary} />
      </TouchableOpacity>

      {/* Your current prices */}
      <Text style={styles.sectionHeader}>{t.yourPrice}</Text>

      {loading ? (
        <ActivityIndicator
          color={colors.accent}
          size="large"
          style={styles.loader}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <View style={styles.catHeader}>
              <Text style={styles.catTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.metalRow}>
              <View style={styles.metalNameRow}>
                <Text style={styles.metalName}>{item.name}</Text>
                {item.is_restricted && (
                  <View style={styles.restrictedBadge}>
                    <Text style={styles.restrictedText}>R</Text>
                  </View>
                )}
              </View>
              <Text style={styles.metalPrice}>
                ${Number(item.price_per_lb).toFixed(4)}/lb
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  linkContent: {
    flex: 1,
  },
  linkTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  linkSub: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
  sectionHeader: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  loader: {
    marginTop: spacing.xxxl,
  },
  catHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  catTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
  },
  metalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  metalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  metalName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
  },
  metalPrice: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontFamily: fonts.monoSemiBold,
  },
  restrictedBadge: {
    backgroundColor: 'rgba(176, 138, 50, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  restrictedText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
  },
});
