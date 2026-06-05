import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useT } from '../../hooks/useT';
import { useAppDispatch, useAppSelector, type RootState } from '../../store';
import { signOut } from '../../store/authStore';
import { setLanguage } from '../../store/settingsStore';
import { type Palette, spacing, fonts, borderRadius } from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

// ── grouped card (design "Group") ───────────────────────────
function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

// ── settings row (design "Row") ─────────────────────────────
function Row({
  label,
  sub,
  tone,
  icon,
  iconColor,
  right,
  onPress,
  last,
}: {
  label: string;
  sub?: string;
  tone?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const body = (
    <>
      {icon ? (
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: (iconColor ?? colors.accent) + '24' },
          ]}
        >
          <Ionicons name={icon} size={18} color={iconColor ?? colors.accent} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, tone ? { color: tone } : null]}>
          {label}
        </Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </>
  );
  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.row, !last && styles.rowBorder]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.row, !last && styles.rowBorder]}>{body}</View>;
}

// ── segmented two-option control (theme + language) ─────────
function Segmented<T extends string>({
  value,
  options,
  onSelect,
}: {
  value: T;
  options: { value: T; label: string }[];
  onSelect: (v: T) => void;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(o.value)}
            activeOpacity={0.8}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const roleLabel = (
  role: string | undefined,
  t: ReturnType<typeof useT>['t']
): string => {
  switch (role) {
    case 'owner':
      return t.roleOwner;
    case 'admin':
      return t.admin;
    case 'worker':
      return t.worker;
    default:
      return '';
  }
};

export default function SettingsScreen() {
  const { t, language } = useT();
  const { colors, isLight, toggle } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const dispatch = useAppDispatch();
  const navigation = useNavigation();
  const nav = navigation as {
    goBack: () => void;
    canGoBack: () => boolean;
    navigate: (name: string, params?: object) => void;
  };

  const profile = useAppSelector((s: RootState) => s.auth.profile);
  const company = useAppSelector((s: RootState) => s.auth.company);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'owner';

  // Theme toggle reloads the app (see utils/themeMode); guard double-taps.
  const [switching, setSwitching] = useState(false);
  const onTheme = (mode: 'light' | 'dark') => {
    if (switching) return;
    if ((mode === 'light') === isLight) return;
    setSwitching(true);
    void toggle();
  };

  const close = () => {
    if (nav.canGoBack()) nav.goBack();
  };

  const onSignOut = () => {
    Alert.alert(t.signOut, t.signOutConfirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.signOut,
        style: 'destructive',
        onPress: () => void dispatch(signOut()),
      },
    ]);
  };

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';

  return (
    <View style={styles.container}>
      {/* header */}
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>{t.settingsEyebrow}</Text>
          <Text style={styles.title}>{t.settings}</Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={close}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
        {/* Account */}
        <Group title={t.account}>
          <Row
            label={profile?.name || t.account}
            sub={profile?.email}
            icon="person-outline"
            right={
              profile?.role ? (
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>
                    {roleLabel(profile.role, t).toUpperCase()}
                  </Text>
                </View>
              ) : undefined
            }
            last={!company}
          />
          {company ? (
            <Row
              label={company.name}
              sub={company.prefix}
              icon="business-outline"
              iconColor={colors.teal}
              last
            />
          ) : null}
        </Group>

        {/* Appearance */}
        <Group title={t.appearance}>
          <Row
            label={t.theme}
            sub={t.themeHint}
            last
            right={
              <Segmented
                value={isLight ? 'light' : 'dark'}
                options={[
                  { value: 'light', label: t.lightMode },
                  { value: 'dark', label: t.darkMode },
                ]}
                onSelect={onTheme}
              />
            }
          />
        </Group>

        {/* Language */}
        <Group title={t.language}>
          <Row
            label={t.language}
            sub={t.languageHint}
            last
            right={
              <Segmented
                value={language}
                options={[
                  { value: 'en', label: t.english },
                  { value: 'es', label: t.spanish },
                ]}
                onSelect={(v) => dispatch(setLanguage(v))}
              />
            }
          />
        </Group>

        {/* Manage / quick links */}
        <Group title={t.manage}>
          <Row
            label={t.customers}
            icon="people-outline"
            right={<Chev />}
            onPress={() => nav.navigate('CustomersTab')}
            last={!isAdmin}
          />
          {isAdmin ? (
            <>
              <Row
                label={t.pricing}
                icon="pricetag-outline"
                right={<Chev />}
                onPress={() => nav.navigate('AdminTab', { screen: 'Pricing' })}
              />
              <Row
                label={t.tabUsers}
                icon="shield-outline"
                right={<Chev />}
                onPress={() => nav.navigate('AdminTab', { screen: 'Users' })}
              />
              <Row
                label={t.companyProfile}
                icon="business-outline"
                right={<Chev />}
                onPress={() =>
                  nav.navigate('AdminTab', { screen: 'CompanyProfile' })
                }
                last
              />
            </>
          ) : null}
        </Group>

        {/* About */}
        <Group title={t.about}>
          <Row
            label={t.appVersion}
            icon="information-circle-outline"
            iconColor={colors.textTertiary}
            right={<Text style={styles.valueMono}>{appVersion}</Text>}
            last
          />
        </Group>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={onSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={19} color={colors.danger} />
          <Text style={styles.signOutText}>{t.signOut}</Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>YardLedger · {appVersion}</Text>
      </ScrollView>
    </View>
  );
}

function Chev() {
  const { colors } = useTheme();
  return (
    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    eyebrow: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    title: {
      fontFamily: fonts.display,
      fontSize: 22,
      letterSpacing: -0.5,
      color: colors.textPrimary,
      marginTop: 3,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 11,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
    group: { marginBottom: 18 },
    groupTitle: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 10.5,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      paddingHorizontal: spacing.xs,
      paddingBottom: 9,
    },
    groupCard: {
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 14,
      paddingHorizontal: spacing.lg,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle },
    rowIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 14,
      color: colors.textPrimary,
    },
    rowSub: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.textTertiary,
      marginTop: 2,
      lineHeight: 15,
    },
    rolePill: {
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: borderRadius.pill,
      backgroundColor: colors.accentMuted,
    },
    rolePillText: {
      fontFamily: fonts.monoSemiBold,
      fontSize: 10,
      letterSpacing: 0.5,
      color: colors.accent,
    },
    valueMono: {
      fontFamily: fonts.monoMedium,
      fontSize: 12.5,
      color: colors.textSecondary,
    },
    segmented: {
      flexDirection: 'row',
      backgroundColor: colors.chip,
      borderRadius: borderRadius.md,
      padding: 3,
      gap: 3,
    },
    segment: {
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: borderRadius.sm + 1,
    },
    segmentActive: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    segmentText: {
      fontFamily: fonts.sansSemiBold,
      fontSize: 12.5,
      color: colors.textTertiary,
    },
    segmentTextActive: { color: colors.textPrimary },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: 15,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.danger + '3d',
      marginTop: spacing.xs,
    },
    signOutText: {
      fontFamily: fonts.sansBold,
      fontSize: 15,
      color: colors.danger,
    },
    footnote: {
      fontFamily: fonts.mono,
      fontSize: 10.5,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing.lg,
    },
  });
