import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SummaryCards } from '../../components';
import { fetchDailySummary, type DailySummary } from '../../services/reports';
import { fetchInventory } from '../../services/inventory';
import { getDateRange } from '../../components/DateRangeSelector';
import { useT } from '../../hooks/useT';
import { useAppSelector, type RootState } from '../../store';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

interface InventoryRow {
  metal_name: string;
  weight: number;
}

export default function DashboardScreen() {
  const { t } = useT();
  const navigation = useNavigation();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange('today');
      const [s, inv] = await Promise.all([
        fetchDailySummary(start, end),
        fetchInventory(),
      ]);
      setSummary(s);
      setInventory(
        (inv ?? [])
          .map((i: { metal_name: string; weight: number }) => ({
            metal_name: i.metal_name,
            weight: Number(i.weight),
          }))
          .filter((i: InventoryRow) => i.weight > 0)
          .sort((a: InventoryRow, b: InventoryRow) => b.weight - a.weight)
          .slice(0, 5)
      );
    } catch {
      // Will show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Today's Summary */}
      <Text style={styles.sectionTitle}>{t.todaysSummary}</Text>
      {summary ? (
        <SummaryCards data={summary} />
      ) : (
        <Text style={styles.emptyText}>{t.noDataForRange}</Text>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>{t.quickActions}</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            (
              navigation as {
                navigate: (
                  screen: string,
                  params?: Record<string, unknown>
                ) => void;
              }
            ).navigate('TransactionsTab', {
              screen: 'NewTransaction',
            })
          }
        >
          <Ionicons name="receipt-outline" size={28} color={colors.accent} />
          <Text style={styles.actionLabel}>{t.newBuy}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            (
              navigation as {
                navigate: (
                  screen: string,
                  params?: Record<string, unknown>
                ) => void;
              }
            ).navigate('SalesTab', { screen: 'NewSale' })
          }
        >
          <Ionicons
            name="trending-up-outline"
            size={28}
            color={colors.success}
          />
          <Text style={styles.actionLabel}>{t.newSale}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() =>
            (
              navigation as {
                navigate: (
                  screen: string,
                  params?: Record<string, unknown>
                ) => void;
              }
            ).navigate('CustomersTab')
          }
        >
          <Ionicons name="people-outline" size={28} color={colors.teal} />
          <Text style={styles.actionLabel}>{t.customers}</Text>
        </TouchableOpacity>
      </View>

      {/* Inventory Snapshot */}
      {inventory.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t.inventorySnapshot}</Text>
          {inventory.map((item) => (
            <View key={item.metal_name} style={styles.invRow}>
              <Text style={styles.invName}>{item.metal_name}</Text>
              <Text style={styles.invWeight}>{item.weight.toFixed(0)} lbs</Text>
            </View>
          ))}
        </>
      )}

      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>
          {profile?.name ?? profile?.email ?? ''}
        </Text>
      </View>

      <View style={{ height: spacing.xxxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.sansSemiBold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    paddingHorizontal: spacing.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sansSemiBold,
    textAlign: 'center',
  },
  invRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  invName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansMedium,
  },
  invWeight: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.mono,
  },
  greeting: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  greetingText: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
});
