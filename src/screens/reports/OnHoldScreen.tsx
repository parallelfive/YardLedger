import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { fetchReceiptsOnHold, type OnHoldRow } from '../../services/reports';
import { RefreshableList } from '../../components';
import { useT } from '../../hooks/useT';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

export default function OnHoldScreen() {
  const { t } = useT();
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
        renderItem={({ item }) => (
          <View
            style={[styles.card, item.is_catalytic && styles.cardCatalytic]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.receipt}>{item.receipt_number}</Text>
              <Text style={styles.days}>
                {daysLeft(item.hold_until)} {t.daysLeft}
              </Text>
            </View>
            <Text style={styles.detail}>
              {t.holdUntil}: {new Date(item.hold_until).toLocaleDateString()}
            </Text>
            {item.is_catalytic && (
              <View style={styles.tag}>
                <Text style={styles.tagText}>{t.catalyticConverter}</Text>
              </View>
            )}
          </View>
        )}
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
    borderLeftColor: colors.warning,
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
  days: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontFamily: fonts.sansBold,
  },
  detail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(176, 138, 50, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  tagText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
  },
});
