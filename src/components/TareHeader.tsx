// Tare global header — locked spec ("Yard on the left, You on the right").
// One header on every primary tab: brand + yard (left), Search · Alerts · Avatar
// (right), then title + a contextual right label. The avatar opens the
// "Account & terminal" sheet — the single door to everything administrative.
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TareMark, Wordmark } from './brand';
import { useT } from '../hooks/useT';
import { useRole } from '../hooks';
import { useTheme, useThemedStyles } from '../theme';
import { useAppDispatch, useAppSelector, type RootState } from '../store';
import { signOut, lockTerminal } from '../store/authStore';
import { toggleLanguage } from '../store/settingsStore';
import { fetchUnreportedReceipts } from '../services/reports';
import { spacing, fonts, type Palette } from '../constants';

const initials = (name: string | undefined) =>
  (name || 'TR')
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function TareHeader({
  title,
  rightLabel,
}: {
  title: string;
  rightLabel?: string;
}) {
  const { t, language } = useT();
  const { colors, isLight, toggle } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const nav = navigation as {
    navigate: (name: string, params?: object) => void;
  };
  const company = useAppSelector((s: RootState) => s.auth.company);
  const identity = useAppSelector((s: RootState) => s.auth.activeIdentity);
  const { isAdmin, role } = useRole();
  const [sheet, setSheet] = useState(false);
  const [alerts, setAlerts] = useState(0);

  // Permission ring: moss = can manage (admin/owner), gold = worker.
  const ring = role === 'worker' ? colors.gold : colors.moss;

  useFocusEffect(
    useCallback(() => {
      fetchUnreportedReceipts()
        .then((r) => setAlerts(r.length))
        .catch(() => setAlerts(0));
    }, [])
  );
  useEffect(() => {
    fetchUnreportedReceipts()
      .then((r) => setAlerts(r.length))
      .catch(() => setAlerts(0));
  }, []);

  const go = (target: () => void) => {
    setSheet(false);
    target();
  };
  const onSignOut = () =>
    Alert.alert(t.signOut, t.signOutConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.signOut,
        style: 'destructive',
        onPress: () => go(() => dispatch(signOut())),
      },
    ]);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]}>
      {/* Row 1 — brand+yard / actions */}
      <View style={styles.row1}>
        <TouchableOpacity
          style={styles.lockup}
          activeOpacity={0.7}
          onPress={() =>
            isAdmin
              ? nav.navigate('AdminTab', { screen: 'CompanyProfile' })
              : undefined
          }
        >
          <TareMark size={30} radius={9} />
          <View style={{ minWidth: 0 }}>
            <Wordmark size={21} tight={-0.5} color={colors.textPrimary} />
            {company ? (
              <Text style={styles.yard} numberOfLines={1}>
                {company.name}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => Alert.alert(t.search, t.searchComingSoon)}
          >
            <Ionicons name="search" size={19} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => nav.navigate('ReportsTab')}
          >
            <Ionicons
              name="notifications-outline"
              size={19}
              color={colors.textSecondary}
            />
            {alerts > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {alerts > 9 ? '9+' : alerts}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.avatar, { borderColor: ring }]}
            onPress={() => setSheet(true)}
          >
            <Text style={[styles.avatarText, { color: ring }]}>
              {initials(identity?.name)}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Row 2 — title + contextual label */}
      <View style={styles.row2}>
        <Text style={styles.title}>{title}</Text>
        {rightLabel ? (
          <Text style={styles.rightLabel}>{rightLabel}</Text>
        ) : null}
      </View>

      {/* Account & terminal sheet */}
      <Modal
        visible={sheet}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSheet(false)}
        >
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            {/* current staffer */}
            <View style={styles.staffer}>
              <View style={[styles.staffAvatar, { borderColor: ring }]}>
                <Text style={[styles.staffInitials, { color: ring }]}>
                  {initials(identity?.name)}
                </Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.staffName}>
                  {identity?.name || t.account}
                </Text>
                <Text style={[styles.staffRole, { color: ring }]}>
                  {(role === 'owner'
                    ? t.roleOwner
                    : role === 'admin'
                      ? t.admin
                      : t.worker
                  ).toUpperCase()}
                </Text>
              </View>
            </View>

            <SheetRow
              icon="swap-horizontal-outline"
              label={t.switchStaffer}
              onPress={() => go(() => dispatch(lockTerminal()))}
            />

            <View style={styles.divider} />
            <SheetRow
              icon="people-outline"
              label={t.customers}
              onPress={() => go(() => nav.navigate('CustomersTab'))}
            />
            {isAdmin ? (
              <>
                <SheetRow
                  icon="pricetag-outline"
                  label={t.pricing}
                  onPress={() =>
                    go(() => nav.navigate('AdminTab', { screen: 'Pricing' }))
                  }
                />
                <SheetRow
                  icon="shield-outline"
                  label={t.tabUsers}
                  onPress={() =>
                    go(() => nav.navigate('AdminTab', { screen: 'Users' }))
                  }
                />
                <SheetRow
                  icon="business-outline"
                  label={t.companyProfile}
                  onPress={() =>
                    go(() =>
                      nav.navigate('AdminTab', { screen: 'CompanyProfile' })
                    )
                  }
                />
              </>
            ) : null}

            <View style={styles.divider} />
            <SheetRow
              icon={isLight ? 'moon-outline' : 'sunny-outline'}
              label={t.theme}
              value={isLight ? t.lightMode : t.darkMode}
              onPress={() => void toggle()}
            />
            <SheetRow
              icon="language-outline"
              label={t.language}
              value={language === 'en' ? t.english : t.spanish}
              onPress={() => dispatch(toggleLanguage())}
            />

            <View style={styles.divider} />
            <SheetRow
              icon="log-out-outline"
              label={t.signOut}
              danger
              onPress={onSignOut}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function SheetRow({
  icon,
  label,
  value,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const tint = danger ? colors.danger : colors.accent;
  return (
    <TouchableOpacity style={styles.sheetRow} onPress={onPress}>
      <Ionicons name={icon} size={22} color={tint} />
      <Text
        style={[styles.sheetLabel, danger ? { color: colors.danger } : null]}
      >
        {label}
      </Text>
      {value ? <Text style={styles.sheetValue}>{value}</Text> : null}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    wrap: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      backgroundColor: colors.background,
    },
    row1: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lockup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 1,
    },
    yard: {
      fontSize: 11.5,
      fontFamily: fonts.sansMedium,
      color: colors.textTertiary,
      marginTop: 1,
    },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    badge: {
      position: 'absolute',
      top: 5,
      right: 5,
      minWidth: 15,
      height: 15,
      borderRadius: 99,
      paddingHorizontal: 3,
      backgroundColor: colors.rust,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    badgeText: { color: '#fff', fontSize: 8.5, fontFamily: fonts.sansBold },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 99,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentMuted,
      borderWidth: 1.5,
    },
    avatarText: { fontSize: 14, fontFamily: fonts.display },
    row2: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginTop: spacing.md,
    },
    title: {
      fontSize: 30,
      fontFamily: fonts.display,
      letterSpacing: -0.8,
      color: colors.textPrimary,
    },
    rightLabel: {
      fontSize: 11.5,
      fontFamily: fonts.mono,
      color: colors.textTertiary,
      paddingBottom: 5,
    },
    // sheet
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 99,
      backgroundColor: colors.borderStrong,
      alignSelf: 'center',
      marginBottom: spacing.lg,
    },
    staffer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: spacing.md,
    },
    staffAvatar: {
      width: 44,
      height: 44,
      borderRadius: 99,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentMuted,
      borderWidth: 1.5,
    },
    staffInitials: { fontSize: 16, fontFamily: fonts.display },
    staffName: {
      fontSize: 16,
      fontFamily: fonts.sansBold,
      color: colors.textPrimary,
    },
    staffRole: {
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.6,
      marginTop: 2,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderSubtle,
      marginVertical: 6,
    },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 13,
    },
    sheetLabel: {
      flex: 1,
      fontSize: 16,
      fontFamily: fonts.sansSemiBold,
      color: colors.textPrimary,
    },
    sheetValue: {
      fontSize: 13,
      fontFamily: fonts.mono,
      color: colors.accent,
    },
  });
