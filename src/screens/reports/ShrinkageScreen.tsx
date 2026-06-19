import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchShrinkageReport,
  type ShrinkageRow,
} from '../../services/reports';
import { useT } from '../../hooks/useT';
import { useResponsive } from '../../hooks';
import { Tag, MetalDot, type Tone } from '../../components/foundry';
import { type Palette, spacing, fontSize, fonts } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

function toneFor(category: string | undefined): Tone {
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

export default function ShrinkageScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { isWide } = useResponsive();
  const [data, setData] = useState<ShrinkageRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchShrinkageReport());
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

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator
          color={colors.accent}
          size="large"
          style={styles.loader}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        isWide && { maxWidth: 640, alignSelf: 'center', width: '100%' },
      ]}
      data={data}
      keyExtractor={(item) => item.metalName}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={loadData}
          tintColor={colors.accent}
        />
      }
      ListHeaderComponent={
        <View style={styles.note}>
          <Ionicons
            name="information-circle-outline"
            size={17}
            color={colors.textTertiary}
          />
          <Text style={styles.noteText}>{t.shrinkageNote}</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isNegative = item.discrepancy < 0;
        const absPct = Math.abs(item.discrepancyPercent);
        const severity =
          absPct > 5 ? colors.rust : absPct > 2 ? colors.gold : colors.moss;
        const tone = toneFor(item.categoryName);
        return (
          <View style={[styles.card, { borderLeftColor: severity }]}>
            <View style={styles.cardHeader}>
              <View style={styles.titleLine}>
                <MetalDot tone={tone} />
                <View style={styles.flex}>
                  <Text style={styles.metalName}>{item.metalName}</Text>
                  <Text style={styles.metalCategory}>{item.categoryName}</Text>
                </View>
              </View>
              <View style={styles.discrepancyCol}>
                <Text style={[styles.discrepancyValue, { color: severity }]}>
                  {isNegative ? '' : '+'}
                  {item.discrepancy.toFixed(0)}
                  <Text style={styles.discrepancyUnit}> lb</Text>
                </Text>
                <Tag
                  label={`${item.discrepancyPercent.toFixed(1)}%`}
                  color={severity}
                  soft={severity + '22'}
                />
              </View>
            </View>
            <View style={styles.stats}>
              <Stat label={t.bought} value={`${item.totalBought.toFixed(0)}`} />
              <View style={styles.statDivider} />
              <Stat label={t.sold} value={`${item.totalSold.toFixed(0)}`} />
              <View style={styles.statDivider} />
              <Stat
                label={t.expected}
                value={`${item.expectedInventory.toFixed(0)}`}
              />
              <View style={styles.statDivider} />
              <Stat
                label={t.actual}
                value={`${item.actualInventory.toFixed(0)}`}
              />
            </View>
          </View>
        );
      }}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons
            name="checkmark-circle-outline"
            size={40}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>{t.noShrinkageData}</Text>
        </View>
      }
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>
        {value}
        <Text style={styles.statUnit}> lb</Text>
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    container: { flex: 1, backgroundColor: colors.background },
    content: { paddingBottom: spacing.xxxl },
    loader: { marginTop: spacing.xxxl },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: 13,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    noteText: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: fonts.sans,
      lineHeight: 17,
    },
    card: {
      backgroundColor: colors.card,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderLeftWidth: 3,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    },
    titleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    metalName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fonts.sansSemiBold,
    },
    metalCategory: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
      marginTop: 1,
    },
    discrepancyCol: { alignItems: 'flex-end', gap: 3 },
    discrepancyValue: {
      fontSize: 17,
      fontFamily: fonts.display,
      letterSpacing: -0.3,
    },
    discrepancyUnit: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
    },
    stats: {
      flexDirection: 'row',
      backgroundColor: colors.surface2,
      borderRadius: 12,
      paddingVertical: spacing.sm,
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statDivider: { width: 1, backgroundColor: colors.borderSubtle },
    statLabel: {
      color: colors.textTertiary,
      fontSize: 9.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fonts.monoSemiBold,
    },
    statUnit: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.mono,
    },
    empty: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
    },
  });
