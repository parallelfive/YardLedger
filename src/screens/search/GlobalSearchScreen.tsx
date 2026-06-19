// Global search (header search icon). Searches receipts (# / customer),
// customers, and metals — results grouped by type, per the Tare header spec.
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { searchReceipts, type ReceiptSearchRow } from '../../services/receipts';
import { searchCustomers, type Customer } from '../../services/customers';
import { fetchMetals } from '../../services/metals';
import { SectionLabel, fmtMoney } from '../../components/foundry';
import { useT } from '../../hooks/useT';
import { useTheme, useThemedStyles } from '../../theme';
import { spacing, fonts, type Palette } from '../../constants';

interface MetalRow {
  id: string;
  name: string;
  price_per_lb: number;
}

export default function GlobalSearchScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const nav = navigation as {
    goBack: () => void;
    navigate: (name: string, params?: object) => void;
  };

  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipts, setReceipts] = useState<ReceiptSearchRow[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [metals, setMetals] = useState<MetalRow[]>([]);
  const allMetals = useRef<MetalRow[]>([]);

  // Metals are a small dynamic set — load once, filter client-side.
  useEffect(() => {
    fetchMetals()
      .then((m) => {
        allMetals.current = (m ?? []) as MetalRow[];
      })
      .catch(() => {});
  }, []);

  // Debounced search across receipts + customers + metals.
  useEffect(() => {
    const query = q.trim();
    if (query.length < 1) {
      setReceipts([]);
      setCustomers([]);
      setMetals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = setTimeout(async () => {
      const [r, c] = await Promise.all([
        searchReceipts(query).catch(() => []),
        searchCustomers(query).catch(() => []),
      ]);
      setReceipts(r);
      setCustomers(c);
      setMetals(
        allMetals.current
          .filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 10)
      );
      setLoading(false);
    }, 220);
    return () => clearTimeout(id);
  }, [q]);

  const empty =
    q.trim().length > 0 &&
    !loading &&
    receipts.length === 0 &&
    customers.length === 0 &&
    metals.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={styles.input}
          placeholder={t.searchPlaceholder}
          placeholderTextColor={colors.textTertiary}
          value={q}
          onChangeText={setQ}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : null}
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={10}>
          <Text style={styles.cancel}>{t.cancel}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {receipts.length > 0 && (
          <>
            <SectionLabel>{t.receipts}</SectionLabel>
            {receipts.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.row}
                onPress={() => {
                  nav.goBack();
                  nav.navigate('ReceiptDetail', { receiptId: r.id });
                }}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.accentMuted },
                  ]}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.customer_name}
                  </Text>
                  <Text style={styles.rowMeta}>{r.receipt_number}</Text>
                </View>
                <Text style={styles.rowRight}>
                  {fmtMoney(Number(r.subtotal))}
                </Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {customers.length > 0 && (
          <>
            <SectionLabel>{t.customers}</SectionLabel>
            {customers.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.row}
                onPress={() => {
                  nav.goBack();
                  nav.navigate('CustomersTab', {
                    screen: 'CustomerProfile',
                    params: { customerId: c.id },
                  });
                }}
              >
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.teal + '24' },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color={colors.teal}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.phone ? (
                    <Text style={styles.rowMeta}>{c.phone}</Text>
                  ) : null}
                </View>
                {c.is_flagged ? (
                  <Ionicons name="flag" size={16} color={colors.rust} />
                ) : null}
              </TouchableOpacity>
            ))}
          </>
        )}

        {metals.length > 0 && (
          <>
            <SectionLabel>{t.metalsWord}</SectionLabel>
            {metals.map((m) => (
              <View key={m.id} style={styles.row}>
                <View
                  style={[
                    styles.rowIcon,
                    { backgroundColor: colors.gold + '24' },
                  ]}
                >
                  <Ionicons
                    name="layers-outline"
                    size={18}
                    color={colors.gold}
                  />
                </View>
                <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={styles.rowRight}>
                  {fmtMoney(Number(m.price_per_lb))}/lb
                </Text>
              </View>
            ))}
          </>
        )}

        {empty ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="search-outline"
              size={36}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>{t.noResults}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    container: { flex: 1, backgroundColor: colors.background },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    input: {
      flex: 1,
      fontSize: 17,
      fontFamily: fonts.sans,
      color: colors.textPrimary,
      paddingVertical: 6,
    },
    cancel: {
      fontSize: 15,
      fontFamily: fonts.sansSemiBold,
      color: colors.accent,
    },
    content: { paddingTop: spacing.sm, paddingBottom: spacing.xxxl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 11,
      paddingHorizontal: spacing.lg,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: {
      fontSize: 15,
      fontFamily: fonts.sansSemiBold,
      color: colors.textPrimary,
    },
    rowMeta: {
      fontSize: 11.5,
      fontFamily: fonts.mono,
      color: colors.textTertiary,
      marginTop: 1,
    },
    rowRight: {
      fontSize: 14,
      fontFamily: fonts.monoSemiBold,
      color: colors.textPrimary,
    },
    emptyWrap: {
      alignItems: 'center',
      paddingTop: spacing.xxxl,
      gap: spacing.sm,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: fonts.sans,
      color: colors.textTertiary,
    },
    sectionSpacer: { height: spacing.lg },
  });
