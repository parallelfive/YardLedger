import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomersStackParamList } from '../../navigation/MainNavigator';
import { Ionicons } from '@expo/vector-icons';
import { Tag, SectionLabel } from '../../components/foundry';
import { useT } from '../../hooks/useT';
import { useCustomers } from '../../hooks';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Props = NativeStackScreenProps<CustomersStackParamList, 'CustomerList'>;

export default function CustomerListScreen({ navigation }: Props) {
  const { t } = useT();
  const { customers, loading, refresh } = useCustomers();
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const filtered = search
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search) ||
          c.drivers_license.includes(search)
      )
    : customers;

  const flaggedCount = customers.filter((c) => c.is_flagged).length;

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Roster hero */}
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>{t.customerRoster}</Text>
              <Text style={styles.heroValue}>{customers.length}</Text>
              <Text style={styles.heroSub}>
                {(customers.length === 1
                  ? t.customer
                  : t.customers
                ).toLowerCase()}
                {flaggedCount > 0
                  ? ` · ${flaggedCount} ${t.flagged.toLowerCase()}`
                  : ''}
              </Text>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <Ionicons
                name="search-outline"
                size={17}
                color={colors.textTertiary}
              />
              <TextInput
                style={styles.searchInput}
                placeholder={t.searchCustomer}
                placeholderTextColor={colors.textTertiary}
                value={search}
                onChangeText={setSearch}
                returnKeyType="search"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons
                    name="close"
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              ) : null}
            </View>

            <SectionLabel>{t.customers}</SectionLabel>
          </>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Ionicons
                name="people-outline"
                size={40}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyTitle}>
                {search ? t.noCustomersFound : t.noCustomers}
              </Text>
              <Text style={styles.emptySub}>{t.customersWillAppear}</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const accent = item.is_flagged ? colors.rust : colors.teal;
          return (
            <TouchableOpacity
              style={[styles.row, { borderLeftColor: accent }]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('CustomerProfile', { customerId: item.id })
              }
            >
              <View
                style={[styles.rowIcon, { backgroundColor: accent + '24' }]}
              >
                <Ionicons
                  name={item.is_flagged ? 'flag' : 'person-outline'}
                  size={19}
                  color={accent}
                />
              </View>
              <View style={styles.rowInfo}>
                <View style={styles.rowTitleLine}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {item.is_flagged ? (
                    <Tag
                      label={t.flagged}
                      color={colors.rust}
                      soft={colors.rust + '22'}
                      icon="flag"
                    />
                  ) : null}
                </View>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[
                    item.phone || null,
                    item.drivers_license
                      ? `${t.dlNumberShort} ${item.drivers_license}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join('  ·  ') || t.noContactInfo}
                </Text>
              </View>
              <View style={styles.rowRight}>
                {item.dl_photo_uri ? (
                  <Tag
                    label={t.idOnFile}
                    color={colors.moss}
                    soft={colors.moss + '22'}
                    icon="checkmark"
                  />
                ) : (
                  <Tag
                    label={t.noIdOnFile}
                    color={colors.gold}
                    soft={colors.gold + '22'}
                  />
                )}
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textTertiary}
                />
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
  },
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
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.sansSemiBold,
    flexShrink: 1,
  },
  rowMeta: {
    color: colors.textTertiary,
    fontSize: 11.5,
    fontFamily: fonts.mono,
    marginTop: 3,
  },
  rowRight: { alignItems: 'flex-end', gap: 5 },
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
