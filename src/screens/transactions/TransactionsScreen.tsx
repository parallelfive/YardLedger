import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '../../hooks/useT';
import { useReceipts } from '../../hooks/useReceipts';
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
import { colors, spacing, fontSize } from '../../constants';

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'TransactionsList'
>;

export default function TransactionsScreen({ navigation }: Props) {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const isAdmin = profile?.role === 'admin';
  const [preset, setPreset] = useState<DatePreset>('today');
  const { start, end } = getDateRange(preset);
  const { receipts, loading, refresh } = useReceipts(
    isAdmin ? undefined : profile?.id,
    start,
    end
  );
  const [showPrices, setShowPrices] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={styles.container}>
      <DateRangeSelector selected={preset} onSelect={setPreset} />
      <RefreshableList
        data={receipts}
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
  receiptCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: 8,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  receiptNumber: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontWeight: 'bold',
  },
  receiptTotal: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: 'bold',
  },
  customerName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
  },
  receiptDate: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  itemCount: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  pricesButton: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pricesButtonText: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.accent,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: 'bold',
  },
});
