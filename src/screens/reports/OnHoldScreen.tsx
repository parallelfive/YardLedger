import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { fetchReceiptsOnHold, type OnHoldRow } from '../../services/reports';
import { RefreshableList } from '../../components';
import { Tag, SectionLabel } from '../../components/foundry';
import { useT } from '../../hooks/useT';
import { colors, spacing, fonts } from '../../constants';

type Nav = { navigate: (s: string, p?: Record<string, unknown>) => void };

const daysLeft = (holdUntil: string) => {
  const ms = new Date(holdUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
};

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

  const { urgentCount, catCount } = useMemo(
    () => ({
      urgentCount: rows.filter((r) => daysLeft(r.hold_until) <= 7).length,
      catCount: rows.filter((r) => r.is_catalytic).length,
    }),
    [rows]
  );

  return (
    <View style={styles.container}>
      <RefreshableList
        data={rows}
        keyExtractor={(item) => item.id}
        loading={loading}
        onRefresh={load}
        contentContainerStyle={styles.content}
        emptyTitle={t.noMaterialOnHold}
        emptySubtitle=""
        ListHeaderComponent={
          rows.length > 0 ? (
            <>
              <View style={styles.triplet}>
                <Stat
                  n={rows.length}
                  label={t.onHoldReport}
                  color={colors.gold}
                />
                <View style={styles.tripletDivider} />
                <Stat n={urgentCount} label={t.daysLeft} color={colors.rust} />
                <View style={styles.tripletDivider} />
                <Stat
                  n={catCount}
                  label={t.catalyticConverter}
                  color={colors.textPrimary}
                />
              </View>
              <SectionLabel>{t.onHoldReport}</SectionLabel>
            </>
          ) : null
        }
        renderItem={({ item }) => {
          const days = daysLeft(item.hold_until);
          const urgent = days <= 7;
          const tone = urgent ? colors.rust : colors.gold;
          return (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.card, { borderLeftColor: tone }]}
              onPress={() =>
                navigation.navigate('TransactionsTab', {
                  screen: 'ReceiptDetail',
                  params: { receiptId: item.id },
                })
              }
            >
              <View style={[styles.icon, { backgroundColor: tone + '24' }]}>
                <Ionicons
                  name={item.is_catalytic ? 'shield-outline' : 'time-outline'}
                  size={19}
                  color={tone}
                />
              </View>
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text style={styles.receipt}>{item.receipt_number}</Text>
                  {item.is_catalytic && (
                    <Tag
                      label={t.catalyticConverter}
                      color={colors.rust}
                      soft={colors.rust + '22'}
                      icon="warning"
                    />
                  )}
                </View>
                <Text style={styles.detail}>
                  {t.holdUntil} {new Date(item.hold_until).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.days, { color: tone }]}>{days}</Text>
                <Text style={styles.daysLabel}>{t.daysLeft}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function Stat({
  n,
  label,
  color,
}: {
  n: number;
  label: string;
  color: string;
}) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statN, { color }]}>{n}</Text>
      <Text style={styles.statL} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxxl },
  triplet: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  tripletDivider: { width: 1, backgroundColor: colors.borderSubtle },
  stat: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  statN: { fontSize: 26, fontFamily: fonts.display, letterSpacing: -0.5 },
  statL: {
    color: colors.textTertiary,
    fontSize: 9.5,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 3,
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  receipt: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.monoSemiBold,
  },
  detail: {
    color: colors.textTertiary,
    fontSize: 11.5,
    fontFamily: fonts.mono,
    marginTop: 3,
  },
  right: { alignItems: 'flex-end' },
  days: { fontSize: 22, fontFamily: fonts.display, letterSpacing: -0.5 },
  daysLabel: {
    color: colors.textTertiary,
    fontSize: 9.5,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 1,
  },
});
