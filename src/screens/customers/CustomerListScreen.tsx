import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomersStackParamList } from '../../navigation/MainNavigator';
import { RefreshableList } from '../../components';
import { Tag } from '../../components/foundry';
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

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={t.searchCustomer}
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setSearch('')}
          >
            <Text style={styles.clearButtonText}>{t.clearSearch}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <RefreshableList
        data={filtered}
        keyExtractor={(item) => item.id}
        loading={loading}
        onRefresh={refresh}
        emptyTitle={t.noCustomers}
        emptySubtitle={t.customersWillAppear}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.customerCard}
            onPress={() =>
              navigation.navigate('CustomerProfile', { customerId: item.id })
            }
          >
            <View style={styles.cardLeft}>
              <Text style={styles.customerName}>{item.name}</Text>
              {item.phone ? (
                <Text style={styles.customerPhone}>{item.phone}</Text>
              ) : null}
              {item.drivers_license ? (
                <Text style={styles.customerDl}>
                  {t.dlNumberShort} {item.drivers_license}
                </Text>
              ) : null}
            </View>
            <View style={styles.cardRight}>
              {item.is_flagged && (
                <Tag
                  label={t.flagged}
                  color={colors.rust}
                  soft="rgba(181, 70, 47, 0.14)"
                  icon="flag"
                />
              )}
              {item.dl_photo_uri ? (
                <Tag
                  label={t.idOnFile}
                  color={colors.moss}
                  soft="rgba(93, 122, 78, 0.16)"
                />
              ) : (
                <Tag
                  label={t.noIdOnFile}
                  color={colors.gold}
                  soft="rgba(176, 138, 50, 0.16)"
                />
              )}
            </View>
          </TouchableOpacity>
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
    fontFamily: fonts.sans,
    borderWidth: 1,
    borderColor: colors.border,
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
  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
  },
  cardLeft: {
    flex: 1,
  },
  cardRight: {
    marginLeft: spacing.md,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  customerName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  customerPhone: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
    marginTop: spacing.xs,
  },
  customerDl: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fonts.sans,
    marginTop: spacing.xs,
  },
  idBadge: {
    backgroundColor: 'rgba(93, 122, 78, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  idBadgeText: {
    color: colors.success,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
  },
  noIdBadge: {
    backgroundColor: 'rgba(176, 138, 50, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  noIdBadgeText: {
    color: colors.warning,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
  },
  flagBadge: {
    backgroundColor: 'rgba(181, 70, 47, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  flagBadgeText: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
  },
});
