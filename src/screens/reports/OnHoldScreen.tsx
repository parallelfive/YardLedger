import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { fetchReceiptsOnHold, type OnHoldRow } from '../../services/reports';
import { RefreshableList } from '../../components';
import { Tag } from '../../components/foundry';
import { useT } from '../../hooks/useT';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Nav = { navigate: (s: string, p?: Record<string, unknown>) => void };

export default function OnHoldScreen() {
  const { t } = useT();
  const navigation = useNavigation() as unknown as Nav;
  const isFocused = useIsFocused();
  const [rows, setRows] = useState<OnHoldRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchReceiptsOnHold());
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) load();
  }, [load, isFocused]);

  const daysLeft = (holdUntil: string) => {
    const ms = new Date(holdUntil).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  };

  return (
    <View style={styles.container}>
      <RefreshableList
        data={rows}
        keyExtractor={(item) => item.id}
        loading={loading}
        onRefresh={load}
        emptyTitle={t.noMaterialOnHold}
        emptySubtitle=""
        renderItem={({ item }) => {
          const days = daysLeft(item.hold_until);
          const urgent = days <= 7;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.card, item.is_catalytic && styles.cardCatalytic]}
              onPress={() =>
                navigation.navigate('TransactionsTab', {
                  screen: 'ReceiptDetail',
                  params: { receiptId: item.id },
                })
              }
            >
              <View style={styles.cardHeader}>
                <Text style={styles.receipt}>{item.receipt_number}</Text>
                <Tag
                  label={`${days} ${t.daysLeft}`}
                  color={urgent ? colors.rust : colors.gold}
                  soft={
                    urgent
                      ? 'rgba(181, 70, 47, 0.14)'
                      : 'rgba(176, 138, 50, 0.15)'
                  }
                />
              </View>
              <Text style={styles.detail}>
                {t.holdUntil}: {new Date(item.hold_until).toLocaleDateString()}
              </Text>
              {item.is_catalytic && (
                <View style={styles.catalyticTag}>
                  <Tag
                    label={t.catalyticConverter}
                    color={colors.rust}
                    soft="rgba(181, 70, 47, 0.14)"
                    icon="warning"
                  />
                </View>
              )}
            </TouchableOpacity>
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
  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  cardCatalytic: {
    borderLeftColor: colors.rust,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receipt: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
  },
  detail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.mono,
    marginTop: spacing.xs,
  },
  catalyticTag: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
});
