import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { useInventory } from '../../hooks/useInventory';
import { useRefreshOnReconnect } from '../../hooks/useRefreshOnReconnect';
import {
  Tag,
  DeltaTag,
  toneColor,
  fmtMoney,
  fmtLbs,
  type Tone,
} from '../../components/foundry';
import { TareHeader } from '../../components';
import {
  type Palette,
  spacing,
  fonts,
  fontSize,
  borderRadius,
} from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

// Visual tone from the (DB-managed) category name — heuristic only, restricted
// always wins. Metals stay dynamic; this just colours the row accent.
function toneFor(category: string | undefined, restricted: boolean): Tone {
  if (restricted) return 'rust';
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

interface Row {
  id: string;
  name: string;
  weight: number;
  avg: number;
  priceNow: number;
  restricted: boolean;
  category: string | undefined;
}

export default function InventoryScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const { inventory, loading, refresh } = useInventory();
  const [cat, setCat] = useState<string>(t.allLabel);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  useRefreshOnReconnect(refresh);

  const rows = useMemo<Row[]>(() => {
    return (inventory as unknown[]).map((raw) => {
      const item = raw as Record<string, unknown>;
      const metals = (
        Array.isArray(item.metals) ? item.metals[0] : item.metals
      ) as Record<string, unknown> | undefined;
      const mc = metals?.metal_categories as
        | { name?: string }
        | { name?: string }[]
        | undefined;
      const category = (Array.isArray(mc) ? mc[0]?.name : mc?.name) as
        | string
        | undefined;
      return {
        id: String(item.id),
        name: String(item.metal_name ?? metals?.name ?? ''),
        weight: Number(item.weight),
        avg: Number(item.avg_cost_per_lb),
        priceNow: Number(metals?.price_per_lb ?? item.avg_cost_per_lb),
        restricted: Boolean(metals?.is_restricted),
        category,
      };
    });
  }, [inventory]);

  const totalValue = rows.reduce((s, r) => s + r.weight * r.avg, 0);
  const totalWeight = rows.reduce((s, r) => s + r.weight, 0);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.category && set.add(r.category));
    const list = [t.allLabel, ...Array.from(set).sort()];
    if (rows.some((r) => r.restricted)) list.push(t.restrictedLabel);
    return list;
  }, [rows, t.allLabel, t.restrictedLabel]);

  const filtered = rows.filter((r) =>
    cat === t.allLabel
      ? true
      : cat === t.restrictedLabel
        ? r.restricted
        : r.category === cat
  );

  return (
    <View style={styles.container}>
      <TareHeader
        title={t.tabInventory}
        rightLabel={`${rows.length} ${t.metalsWord}`}
      />
      <FlatList
        data={filtered}
        keyExtractor={(r) => r.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            {/* On-hand value hero */}
            <View style={styles.hero}>
              <View style={styles.heroTopRow}>
                <Text style={styles.heroEyebrow}>{t.onHandValue}</Text>
              </View>
              <Text style={styles.heroValue}>{fmtMoney(totalValue)}</Text>
              <Text style={styles.heroSub}>
                {fmtLbs(totalWeight)} lb · {rows.length} {t.metalsWord}
              </Text>
            </View>

            {/* Category chips */}
            <View style={styles.chipsRow}>
              {categories.map((c) => {
                const active = c === cat;
                return (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setCat(c)}
                  >
                    <Text
                      style={[styles.chipText, active && styles.chipTextActive]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons
                name="cube-outline"
                size={40}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>{t.noInventory}</Text>
              <Text style={styles.emptySub}>{t.inventoryAutoUpdate}</Text>
            </View>
          )
        }
        renderItem={({ item: r }) => {
          const spread = r.priceNow - r.avg;
          const up = spread >= 0;
          const tone = toneFor(r.category, r.restricted);
          return (
            <View style={[styles.row, { borderLeftColor: toneColor(tone) }]}>
              <View style={styles.rowInfo}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowName}>{r.name}</Text>
                  {r.restricted && (
                    <Tag
                      label={t.restrictedLabel}
                      color={colors.rust}
                      soft={colors.rust + '22'}
                    />
                  )}
                </View>
                <Text style={styles.rowMeta}>
                  {fmtMoney(r.priceNow, 2)} {t.nowAvg} {fmtMoney(r.avg, 2)}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowWeight}>
                  {fmtLbs(r.weight)}
                  <Text style={styles.rowWeightUnit}> lb</Text>
                </Text>
                <DeltaTag up={up}>{fmtMoney(Math.abs(spread), 2)}</DeltaTag>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
      gap: spacing.sm,
    },
    hero: {
      padding: spacing.lg,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    heroTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    heroEyebrow: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    heroValue: {
      color: colors.textPrimary,
      fontSize: 40,
      fontFamily: fonts.display,
      letterSpacing: -1,
      marginTop: 5,
    },
    heroSub: {
      color: colors.textSecondary,
      fontSize: 12.5,
      fontFamily: fonts.mono,
      marginTop: 5,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    chip: {
      paddingHorizontal: 15,
      paddingVertical: 8,
      borderRadius: 100,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipActive: {
      backgroundColor: colors.textPrimary,
      borderColor: colors.textPrimary,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: fonts.sansSemiBold,
    },
    chipTextActive: { color: colors.background },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.card,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      borderLeftWidth: 3,
    },
    rowInfo: { flex: 1 },
    rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    rowName: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fonts.sansSemiBold,
    },
    rowMeta: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
      marginTop: 3,
    },
    rowRight: { alignItems: 'flex-end', gap: 2 },
    rowWeight: {
      color: colors.textPrimary,
      fontSize: 17,
      fontFamily: fonts.display,
      letterSpacing: -0.3,
    },
    rowWeightUnit: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
    },
    empty: { alignItems: 'center', paddingTop: spacing.xxxl, gap: spacing.sm },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansSemiBold,
    },
    emptySub: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: fonts.sans,
      textAlign: 'center',
    },
  });
