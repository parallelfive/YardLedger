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
import { useUserApproval } from '../../hooks/useUserApproval';
import { useInviteCodes } from '../../hooks/useInviteCodes';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import { useAppSelector, useAppDispatch, type RootState } from '../../store';
import { toggleLanguage } from '../../store/settingsStore';
import { createAccessCode } from '../../services/accessCodes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/MainNavigator';
import type { PendingUser, UserRole } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

type Props = NativeStackScreenProps<AdminStackParamList, 'Users'>;

export default function UserApprovalScreen({ navigation }: Props) {
  const { t, language } = useT();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const company = useCurrentCompany();
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

  const callerIsOwner = profile?.role === 'owner';

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

  const onGenerateCode = async () => {
    if (!profile) return;
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
      setGeneratedInvite(code);
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
    Alert.alert(t.promoteToAdmin, t.promoteAdminMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.promote,
        onPress: async () => {
          try {
            await handleChangeRole(userId, newRole);
          } catch (err) {
            Alert.alert(t.error, (err as Error).message);
          }
        },
      },
    ]);
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

    return (
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          <Text style={styles.userEmail}>{item.email}</Text>
          <Text style={styles.userMeta}>
            {roleLabel(item.role as UserRole)}
            {item.is_active ? '' : ` (${t.pendingApproval.toLowerCase()})`}
          </Text>
        </View>
        <View style={styles.actions}>
          {isPending ? (
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => onApprove(item.id)}
            >
              <Text style={styles.approveButtonText}>{t.approve}</Text>
            </TouchableOpacity>
          ) : (
            <>
              {rolesToShow.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={styles.adminButton}
                  onPress={() => onChangeRole(item.id, role)}
                >
                  <Text style={styles.adminButtonText}>{roleLabel(role)}</Text>
                </TouchableOpacity>
              ))}
              {canManage && (
                <TouchableOpacity
                  style={styles.deactivateButton}
                  onPress={() => onDeactivate(item.id)}
                >
                  <Text style={styles.deactivateButtonText}>
                    {t.deactivate}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  const invitableRoles: UserRole[] = callerIsOwner
    ? ['worker', 'admin', 'owner']
    : ['worker', 'admin'];

  return (
    <FlatList
      style={styles.container}
      data={[...pendingUsers, ...activeUsers]}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={refresh}
      ListHeaderComponent={
        <>
          {/* Company Header */}
          {company && (
            <View style={styles.companyHeader}>
              <Text style={styles.companyName}>{company.name}</Text>
              <Text style={styles.companyPrefix}>{company.prefix}</Text>
            </View>
          )}

          {/* Invite User */}
          <View style={styles.codeSection}>
            <Text style={styles.codeSectionTitle}>{t.inviteUser}</Text>
            <View style={styles.rolePicker}>
              {invitableRoles.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.rolePill,
                    inviteRole === role && styles.rolePillActive,
                  ]}
                  onPress={() => setInviteRole(role)}
                >
                  <Text
                    style={[
                      styles.rolePillText,
                      inviteRole === role && styles.rolePillTextActive,
                    ]}
                  >
                    {roleLabel(role)}
                  </Text>
                </TouchableOpacity>
              ))}
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
                <Text style={styles.generateButtonText}>
                  {generatingInvite ? t.loading : t.generateInviteCode}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Unused Invite Codes */}
          <View style={styles.codeSection}>
            <Text style={styles.codeSectionTitle}>{t.unusedInviteCodes}</Text>
            {unusedInviteCodes.length === 0 ? (
              <Text style={styles.codeHint}>{t.noUnusedInviteCodes}</Text>
            ) : (
              unusedInviteCodes.map((c) => (
                <View key={c.id} style={styles.inviteRow}>
                  <View style={styles.inviteRowInfo}>
                    <Text style={styles.inviteRowCode}>{c.code}</Text>
                    <Text style={styles.inviteRowMeta}>
                      {roleLabel(c.role as UserRole)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => onDeleteInviteCode(c.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.danger}
                    />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Access Code (price override) */}
          <View style={styles.codeSection}>
            <Text style={styles.codeSectionTitle}>{t.accessCode}</Text>
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
                <Text style={styles.generateButtonText}>
                  {generating ? t.loading : t.generateCode}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Pricing Link */}
          <TouchableOpacity
            style={styles.pricingButton}
            onPress={() => navigation.navigate('Pricing')}
          >
            <View style={styles.linkRow}>
              <Ionicons
                name="pricetags-outline"
                size={22}
                color={colors.accent}
              />
              <Text style={styles.pricingButtonText}>{t.editPricing}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          {/* Company Profile Link */}
          <TouchableOpacity
            style={styles.pricingButton}
            onPress={() => navigation.navigate('CompanyProfile')}
          >
            <View style={styles.linkRow}>
              <Ionicons
                name="business-outline"
                size={22}
                color={colors.accent}
              />
              <Text style={styles.pricingButtonText}>{t.companyProfile}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          {/* Market Prices Link */}
          <TouchableOpacity
            style={styles.pricingButton}
            onPress={() => navigation.navigate('MarketPrices')}
          >
            <View style={styles.linkRow}>
              <Ionicons
                name="trending-up-outline"
                size={22}
                color={colors.teal}
              />
              <Text style={styles.pricingButtonText}>{t.marketPrices}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          {/* Language Toggle */}
          <TouchableOpacity
            style={styles.pricingButton}
            onPress={() => dispatch(toggleLanguage())}
          >
            <View style={styles.linkRow}>
              <Ionicons
                name="language-outline"
                size={22}
                color={colors.accent}
              />
              <Text style={styles.pricingButtonText}>{t.language}</Text>
            </View>
            <Text style={styles.languageValue}>
              {language === 'en' ? t.english : t.spanish}
            </Text>
          </TouchableOpacity>

          {/* Pending Users Header */}
          {pendingUsers.length > 0 && (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t.pendingApproval} ({pendingUsers.length})
              </Text>
            </View>
          )}
        </>
      }
      renderItem={({ item }) =>
        renderUser({ item, isPending: !item.is_active })
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t.noUsersFound}</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  companyHeader: {
    margin: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  companyName: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  companyPrefix: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  sectionHeader: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.warning,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.lg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  userInfo: {
    flex: 1,
  },
  userEmail: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  userMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  approveButton: {
    backgroundColor: colors.success,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  approveButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.sm,
  },
  adminButton: {
    backgroundColor: colors.accent,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  adminButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: fontSize.sm,
  },
  deactivateButton: {
    backgroundColor: colors.danger,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  deactivateButtonText: {
    color: colors.white,
    fontWeight: 'bold',
    fontSize: fontSize.sm,
  },
  pricingButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  pricingButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '600',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  languageValue: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  codeSection: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  codeSectionTitle: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  codeDisplay: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  codeText: {
    color: colors.textPrimary,
    fontSize: fontSize.title,
    fontWeight: '700',
    letterSpacing: 6,
  },
  codeHint: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  generateButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  generateButtonText: {
    color: colors.background,
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  rolePicker: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rolePill: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  rolePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  rolePillText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  rolePillTextActive: {
    color: colors.background,
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  inviteRowInfo: {
    flex: 1,
  },
  inviteRowCode: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 2,
  },
  inviteRowMeta: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  empty: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.xl,
  },
});
