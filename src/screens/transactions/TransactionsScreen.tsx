import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '../../hooks/useT';
import { useReceipts } from '../../hooks/useReceipts';
import { useSales } from '../../hooks/useSales';
import { useAppSelector, type RootState } from '../../store';
import {
  RefreshableList,
  PriceSheetModal,
  DateRangeSelector,
} from '../../components';
import {
  type DatePreset,
  getDateRange,
} from '../../components/DateRangeSelector';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'TransactionsList'
>;

export default function TransactionsScreen({ navigation }: Props) {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';
  const [preset, setPreset] = useState<DatePreset>('today');
  const { start, end } = getDateRange(preset);
  const { receipts, loading, refresh } = useReceipts(
    isAdmin ? undefined : profile?.id,
    start,
    end
  );
  const { sales, refresh: refreshSales } = useSales(start, end);
  const [showPrices, setShowPrices] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshSales();
    }, [refresh, refreshSales])
  );

  const filteredReceipts = useMemo(() => {
    if (!appliedSearch) return receipts;
    const q = appliedSearch.toLowerCase();
    return receipts.filter((r) => {
      if (r.customer_name?.toLowerCase().includes(q)) return true;
      if (r.receipt_number?.toLowerCase().includes(q)) return true;
      if (
        r.line_items?.some((li: { metal_name?: string }) =>
          li.metal_name?.toLowerCase().includes(q)
        )
      )
        return true;
      return false;
    });
  }, [receipts, appliedSearch]);

  const handleSearch = () => {
    setAppliedSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
  };

  const stats = useMemo(() => {
    const buyCount = receipts.length;
    const buyTotal = receipts.reduce(
      (sum, r) => sum + Number(r.subtotal ?? 0),
      0
    );
    const saleCount = sales.length;
    const saleTotal = sales.reduce(
      (sum, s) => sum + Number(s.total_revenue ?? 0),
      0
    );
    return { buyCount, buyTotal, saleCount, saleTotal };
  }, [receipts, sales]);

  return (
    <View style={styles.container}>
      <DateRangeSelector selected={preset} onSelect={setPreset} />
      {(stats.buyCount > 0 || stats.saleCount > 0) && (
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.buyCount}</Text>
            <Text style={styles.statLabel}>{t.buys}</Text>
            <Text style={styles.statSub}>${stats.buyTotal.toFixed(2)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.saleCount}</Text>
            <Text style={styles.statLabel}>{t.tabSales}</Text>
            <Text style={styles.statSub}>${stats.saleTotal.toFixed(2)}</Text>
          </View>
        </View>
      )}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={t.searchReceipts}
          placeholderTextColor={colors.textTertiary}
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {appliedSearch ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearSearch}
          >
            <Text style={styles.clearButtonText}>{t.clearSearch}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>{t.search}</Text>
          </TouchableOpacity>
        )}
      </View>
      <RefreshableList
        data={filteredReceipts}
        keyExtractor={(item) => item.id}
        loading={loading}
        onRefresh={refresh}
        emptyTitle={t.noTransactions}
        emptySubtitle={t.tapToRecordBuy}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.receiptCard}
            onPress={() =>
              navigation.navigate('ReceiptDetail', { receiptId: item.id })
            }
            onLongPress={() =>
              navigation.navigate('ReceiptDetail', {
                receiptId: item.id,
                printOnLoad: true,
              })
            }
          >
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptNumber}>{item.receipt_number}</Text>
              <Text style={styles.receiptTotal}>
                ${Number(item.subtotal).toFixed(2)}
              </Text>
            </View>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.receiptDate}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
            {item.line_items && (
              <Text style={styles.itemCount}>
                {item.line_items.length}{' '}
                {item.line_items.length === 1 ? 'item' : 'items'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.pricesButton}
        onPress={() => setShowPrices(true)}
      >
        <Text style={styles.pricesButtonText}>{t.pricing}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewTransaction')}
      >
        <Text style={styles.fabText}>{t.newBuy}</Text>
      </TouchableOpacity>

      <PriceSheetModal
        visible={showPrices}
        onClose={() => setShowPrices(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  searchButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  clearButton: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    color: colors.accent,
    fontSize: fontSize.xxl,
    fontFamily: fonts.monoSemiBold,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  statSub: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
  },
  receiptCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  receiptNumber: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.monoMedium,
    letterSpacing: 0.5,
  },
  receiptTotal: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontFamily: fonts.monoSemiBold,
  },
  customerName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  receiptDate: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  itemCount: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fonts.mono,
    marginTop: spacing.xs,
  },
  pricesButton: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pricesButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    elevation: 5,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  fabText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
  },
});
