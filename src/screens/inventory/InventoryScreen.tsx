import { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '../../hooks/useT';
import { useInventory } from '../../hooks/useInventory';
import { RefreshableList } from '../../components';
import { TicketRow, fmtMoney, fmtLbs } from '../../components/foundry';
import { colors, spacing } from '../../constants';
import { calculateInventoryValue } from '../../utils/calculations';

export default function InventoryScreen() {
  const { t } = useT();
  const { inventory, loading, refresh } = useInventory();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <View style={styles.container}>
      <RefreshableList
        data={inventory}
        keyExtractor={(item) => item.id}
        loading={loading}
        onRefresh={refresh}
        emptyTitle={t.noInventory}
        emptySubtitle={t.inventoryAutoUpdate}
        renderItem={({ item }) => {
          const weight = Number(item.weight);
          const avg = Number(item.avg_cost_per_lb);
          return (
            <View style={styles.rowWrap}>
              <TicketRow
                icon="cube-outline"
                iconColor={colors.teal}
                customer={item.metal_name}
                meta={`${fmtMoney(avg, 4)}/lb avg`}
                total={`${fmtLbs(weight)} lb`}
                sub={fmtMoney(calculateInventoryValue(weight, avg))}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  rowWrap: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
});
