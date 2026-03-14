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
import { useAppSelector, type RootState } from '../../store';
import { createAccessCode } from '../../services/accessCodes';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AdminStackParamList } from '../../navigation/MainNavigator';
import type { PendingUser } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

type Props = NativeStackScreenProps<AdminStackParamList, 'Users'>;

export default function UserApprovalScreen({ navigation }: Props) {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const {
    pendingUsers,
    activeUsers,
    loading,
    refresh,
    handleApprove,
    handleDeactivate,
    handlePromote,
  } = useUserApproval();
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const onGenerateCode = async () => {
    if (!profile) return;
    setGenerating(true);
    try {
      const code = await createAccessCode(profile.id);
      setGeneratedCode(code);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setGenerating(false);
    }
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

  const onPromote = (userId: string) => {
    Alert.alert(t.promoteToAdmin, t.promoteAdminMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.promote,
        onPress: async () => {
          try {
            await handlePromote(userId);
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
  }) => (
    <View style={styles.userCard}>
      <View style={styles.userInfo}>
        <Text style={styles.userEmail}>{item.email}</Text>
        <Text style={styles.userMeta}>
          {item.role} {item.is_active ? '' : '(pending)'}
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
            {item.role !== 'admin' && (
              <TouchableOpacity
                style={styles.adminButton}
                onPress={() => onPromote(item.id)}
              >
                <Text style={styles.adminButtonText}>{t.admin}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.deactivateButton}
              onPress={() => onDeactivate(item.id)}
            >
              <Text style={styles.deactivateButtonText}>{t.deactivate}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={[...pendingUsers, ...activeUsers]}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={refresh}
      ListHeaderComponent={
        <>
          {/* Access Code Generator */}
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
  codeSection: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 4,
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
    letterSpacing: 8,
  },
  codeHint: {
    color: colors.warning,
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
  empty: {
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: fontSize.xl,
  },
});
