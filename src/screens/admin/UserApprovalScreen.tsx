import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
} from 'react-native';
import { useT } from '../../hooks/useT';
import { useRole, useResponsive } from '../../hooks';
import { useUserApproval } from '../../hooks/useUserApproval';
import { useInviteCodes } from '../../hooks/useInviteCodes';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { useAppSelector, useAppDispatch, type RootState } from '../../store';
import { toggleLanguage } from '../../store/settingsStore';
import { createAccessCode } from '../../services/accessCodes';
import { useAdminElevation } from '../../providers/AdminElevationProvider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/MainNavigator';
import type { PendingUser, UserRole } from '../../types';
import { Tag } from '../../components/foundry';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemedStyles } from '../../theme';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Props = NativeStackScreenProps<AdminStackParamList, 'Users'>;

export default function UserApprovalScreen({ navigation }: Props) {
  const { t, language } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const company = useCurrentCompany();
  const { ensureElevated } = useAdminElevation();
  const { isWide } = useResponsive();
  const {
    pendingUsers,
    activeUsers,
    loading,
    refresh,
    handleApprove,
    handleDeactivate,
    handleChangeRole,
  } = useUserApproval();
  const {
    unused: unusedInviteCodes,
    generate: generateInviteCode,
    remove: removeInviteCode,
  } = useInviteCodes();

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [inviteRole, setInviteRole] = useState<UserRole>('worker');
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const { isOwner: callerIsOwner } = useRole();

  const roleLabel = (role: UserRole): string => {
    switch (role) {
      case 'owner':
        return t.roleOwner;
      case 'admin':
        return t.roleAdmin;
      case 'worker':
        return t.roleWorker;
    }
  };

  // Role pill colours: owner = accent, admin = teal, worker = neutral.
  const roleColor = (role: UserRole): string => {
    switch (role) {
      case 'owner':
        return colors.accent;
      case 'admin':
        return colors.teal;
      case 'worker':
        return colors.textSecondary;
    }
  };

  const onGenerateCode = async () => {
    if (!profile) return;
    if (!(await ensureElevated())) return;
    setGenerating(true);
    try {
      const code = await createAccessCode();
      setGeneratedCode(code);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const onGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const code = await generateInviteCode(inviteRole);
      if (code) setGeneratedInvite(code);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const onDeleteInviteCode = (id: string) => {
    Alert.alert(t.delete, t.areYouSure, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await removeInviteCode(id);
          } catch (err) {
            Alert.alert(t.error, (err as Error).message);
          }
        },
      },
    ]);
  };

  const onApprove = async (userId: string) => {
    try {
      await handleApprove(userId);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    }
  };

  const onDeactivate = (userId: string) => {
    Alert.alert(t.deactivateUser, t.areYouSure, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deactivate,
        style: 'destructive',
        onPress: async () => {
          try {
            await handleDeactivate(userId);
          } catch (err) {
            Alert.alert(t.error, (err as Error).message);
          }
        },
      },
    ]);
  };

  const onChangeRole = (userId: string, newRole: UserRole) => {
    // Role-aware copy — this handles demotions (e.g. -> worker) too, not just
    // promotion to admin. Treat a demotion to worker as destructive.
    const isDemotion = newRole === 'worker';
    Alert.alert(
      t.changeRoleTitle,
      t.changeRoleMessage.replace('{role}', roleLabel(newRole)),
      [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.confirm,
          style: isDemotion ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await handleChangeRole(userId, newRole);
            } catch (err) {
              Alert.alert(t.error, (err as Error).message);
            }
          },
        },
      ]
    );
  };

  // Initials for the avatar tile (from name, falling back to email).
  const initials = (item: PendingUser): string => {
    const src = item.name?.trim() || item.email;
    const parts = src
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean);
    const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
    return (letters || src.slice(0, 2)).toUpperCase();
  };

  const renderUser = ({
    item,
    isPending,
  }: {
    item: PendingUser;
    isPending: boolean;
  }) => {
    // Caller's management rights over this target
    const targetIsOwner = item.role === 'owner';
    const canManage = callerIsOwner || !targetIsOwner;

    // Which role buttons to offer (exclude target's current role)
    const availableRoles: UserRole[] = callerIsOwner
      ? ['worker', 'admin', 'owner']
      : ['worker', 'admin'];
    const rolesToShow = canManage
      ? availableRoles.filter((r) => r !== (item.role as UserRole))
      : [];

    const rc = roleColor(item.role as UserRole);

    return (
      <View style={styles.userCard}>
        <View style={styles.userTopRow}>
          <View style={[styles.avatar, { backgroundColor: rc + '22' }]}>
            <Text style={[styles.avatarText, { color: rc }]}>
              {initials(item)}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userEmail} numberOfLines={1}>
              {item.name?.trim() || item.email}
            </Text>
            {item.name?.trim() ? (
              <Text style={styles.userSub} numberOfLines={1}>
                {item.email}
              </Text>
            ) : null}
          </View>
          <View style={styles.userTags}>
            <Tag
              label={roleLabel(item.role as UserRole)}
              color={rc}
              soft={rc + '1f'}
            />
            {isPending && (
              <Tag
                label={t.pendingApproval}
                color={colors.gold}
                soft={colors.gold + '24'}
              />
            )}
          </View>
        </View>

        <View style={styles.actions}>
          {isPending ? (
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => onApprove(item.id)}
            >
              <Ionicons name="checkmark" size={15} color={colors.white} />
              <Text style={styles.approveButtonText}>{t.approve}</Text>
            </TouchableOpacity>
          ) : (
            rolesToShow.map((role) => (
              <TouchableOpacity
                key={role}
                style={styles.roleActionButton}
                onPress={() => onChangeRole(item.id, role)}
              >
                <Text style={styles.roleActionText}>{roleLabel(role)}</Text>
              </TouchableOpacity>
            ))
          )}
          {canManage && (
            <TouchableOpacity
              style={styles.deactivateButton}
              onPress={() => onDeactivate(item.id)}
            >
              <Text style={styles.deactivateButtonText}>{t.deactivate}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const invitableRoles: UserRole[] = callerIsOwner
    ? ['worker', 'admin', 'owner']
    : ['worker', 'admin'];

  const data = [...pendingUsers, ...activeUsers];

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        isWide && { maxWidth: 640, alignSelf: 'center', width: '100%' },
      ]}
      data={data}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={refresh}
      ListHeaderComponent={
        <>
          {/* Company identity */}
          {company && (
            <View style={styles.identity}>
              <View style={styles.identityLogo}>
                <Text style={styles.identityMono}>
                  {(
                    company.prefix.replace(/[^A-Za-z]/g, '').slice(0, 2) || 'GR'
                  ).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.companyName} numberOfLines={1}>
                  {company.name}
                </Text>
                <Text style={styles.companyPrefix}>{company.prefix}</Text>
              </View>
            </View>
          )}

          {/* Invite User */}
          <Text style={styles.groupTitle}>{t.inviteUser}</Text>
          <View style={styles.card}>
            <View style={styles.rolePicker}>
              {invitableRoles.map((role) => {
                const active = inviteRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[styles.rolePill, active && styles.rolePillActive]}
                    onPress={() => setInviteRole(role)}
                  >
                    <Text
                      style={[
                        styles.rolePillText,
                        active && styles.rolePillTextActive,
                      ]}
                    >
                      {roleLabel(role)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {generatedInvite ? (
              <View style={styles.codeDisplay}>
                <Text style={styles.codeText}>{generatedInvite}</Text>
                <Text style={styles.codeHint}>{t.shareInviteCode}</Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={onGenerateInvite}
                  disabled={generatingInvite}
                >
                  <Text style={styles.generateButtonText}>
                    {t.generateInviteCode}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.generateButton}
                onPress={onGenerateInvite}
                disabled={generatingInvite}
              >
                <Ionicons name="add" size={17} color={colors.accentInk} />
                <Text style={styles.generateButtonText}>
                  {generatingInvite ? t.loading : t.generateInviteCode}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Unused Invite Codes */}
          <Text style={styles.groupTitle}>{t.unusedInviteCodes}</Text>
          <View style={styles.card}>
            {unusedInviteCodes.length === 0 ? (
              <Text style={styles.codeHint}>{t.noUnusedInviteCodes}</Text>
            ) : (
              unusedInviteCodes.map((c, i) => (
                <View
                  key={c.id}
                  style={[styles.inviteRow, i === 0 && styles.inviteRowFirst]}
                >
                  <View style={styles.inviteRowInfo}>
                    <Text style={styles.inviteRowCode}>{c.code}</Text>
                    <Tag
                      label={roleLabel(c.role as UserRole)}
                      color={roleColor(c.role as UserRole)}
                      soft={roleColor(c.role as UserRole) + '1f'}
                    />
                  </View>
                  <TouchableOpacity
                    onPress={() => onDeleteInviteCode(c.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color={colors.danger}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Access Code (price override) */}
          <Text style={styles.groupTitle}>{t.accessCode}</Text>
          <View style={styles.card}>
            {generatedCode ? (
              <View style={styles.codeDisplay}>
                <Text style={styles.codeText}>{generatedCode}</Text>
                <Text style={styles.codeHint}>{t.codeGenerated}</Text>
                <TouchableOpacity
                  style={styles.generateButton}
                  onPress={onGenerateCode}
                  disabled={generating}
                >
                  <Text style={styles.generateButtonText}>{t.generateNew}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.generateButton}
                onPress={onGenerateCode}
                disabled={generating}
              >
                <Ionicons
                  name="lock-closed"
                  size={16}
                  color={colors.accentInk}
                />
                <Text style={styles.generateButtonText}>
                  {generating ? t.loading : t.generateCode}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Manage links */}
          <Text style={styles.groupTitle}>{t.manageSection}</Text>
          <View style={styles.card}>
            <LinkRow
              icon="pricetag-outline"
              tint={colors.accent}
              label={t.editPricing}
              onPress={() => navigation.navigate('Pricing')}
              first
            />
            <LinkRow
              icon="business-outline"
              tint={colors.accent}
              label={t.companyProfile}
              onPress={() => navigation.navigate('CompanyProfile')}
            />
            <LinkRow
              icon="trending-up-outline"
              tint={colors.teal}
              label={t.marketPrices}
              onPress={() => navigation.navigate('MarketPrices')}
            />
            <LinkRow
              icon="language-outline"
              tint={colors.accent}
              label={t.language}
              value={language === 'en' ? t.english : t.spanish}
              onPress={() => dispatch(toggleLanguage())}
              last
            />
          </View>

          {/* Team header */}
          <Text style={styles.groupTitle}>
            {pendingUsers.length > 0
              ? `${t.pendingApproval} (${pendingUsers.length})`
              : t.teamSection}
          </Text>
        </>
      }
      renderItem={({ item }) =>
        renderUser({ item, isPending: !item.is_active })
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons
            name="people-outline"
            size={40}
            color={colors.textTertiary}
          />
          <Text style={styles.emptyText}>{t.noUsersFound}</Text>
        </View>
      }
    />
  );
}

// ── settings-style link row inside a card ─────────────────────
function LinkRow({
  icon,
  tint,
  label,
  value,
  onPress,
  first,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  label: string;
  value?: string;
  onPress: () => void;
  first?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity
      style={[
        styles.linkRow,
        !first && styles.linkRowBorder,
        last && styles.linkRowLast,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.linkIcon, { backgroundColor: tint + '1f' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.linkLabel}>{label}</Text>
      {value ? (
        <Text style={styles.linkValue}>{value}</Text>
      ) : (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textTertiary}
        />
      )}
    </TouchableOpacity>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    // ── identity ──
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    identityLogo: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: colors.textPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    identityMono: {
      color: colors.background,
      fontSize: 18,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
    },
    companyName: {
      color: colors.textPrimary,
      fontSize: fontSize.xl,
      fontFamily: fonts.sansBold,
    },
    companyPrefix: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
      marginTop: 2,
    },
    // ── group title + card ──
    groupTitle: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      paddingHorizontal: spacing.xs,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    // ── invite role picker ──
    rolePicker: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    rolePill: {
      flex: 1,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    rolePillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    rolePillText: {
      color: colors.textSecondary,
      fontFamily: fonts.sansSemiBold,
      fontSize: fontSize.sm,
    },
    rolePillTextActive: {
      color: colors.accentInk,
    },
    // ── code display ──
    codeDisplay: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    codeText: {
      color: colors.textPrimary,
      fontSize: fontSize.title,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 6,
    },
    codeHint: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sans,
      textAlign: 'center',
    },
    generateButton: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: colors.accent,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    generateButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
    // ── invite code rows ──
    inviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    inviteRowFirst: {
      borderTopWidth: 0,
      paddingTop: 0,
    },
    inviteRowInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      flex: 1,
    },
    inviteRowCode: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 2,
    },
    // ── link rows ──
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    linkRowBorder: {
      borderTopWidth: 1,
      borderTopColor: colors.borderSubtle,
    },
    linkRowLast: {},
    linkIcon: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkLabel: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansSemiBold,
    },
    linkValue: {
      color: colors.accent,
      fontSize: fontSize.md,
      fontFamily: fonts.monoMedium,
    },
    // ── user cards ──
    userCard: {
      backgroundColor: colors.card,
      marginBottom: spacing.sm,
      padding: spacing.md,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    userTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontSize: 14,
      fontFamily: fonts.sansBold,
    },
    userInfo: { flex: 1, minWidth: 0 },
    userEmail: {
      color: colors.textPrimary,
      fontSize: 14.5,
      fontFamily: fonts.sansSemiBold,
    },
    userSub: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: fonts.mono,
      marginTop: 1,
    },
    userTags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      flexWrap: 'wrap',
      marginTop: spacing.md,
    },
    approveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.success,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    approveButtonText: {
      color: colors.white,
      fontFamily: fonts.sansBold,
      fontSize: fontSize.sm,
    },
    roleActionButton: {
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    roleActionText: {
      color: colors.textPrimary,
      fontFamily: fonts.sansSemiBold,
      fontSize: fontSize.sm,
    },
    deactivateButton: {
      backgroundColor: colors.danger + '14',
      borderWidth: 1,
      borderColor: colors.danger + '40',
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    deactivateButtonText: {
      color: colors.danger,
      fontFamily: fonts.sansSemiBold,
      fontSize: fontSize.sm,
    },
    empty: {
      paddingTop: spacing.xxxl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sans,
    },
  });
