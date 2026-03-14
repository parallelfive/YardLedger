import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAppDispatch, useAppSelector, type RootState } from '../../store';
import { fetchProfile, signOut } from '../../store/authStore';
import { useT } from '../../hooks/useT';
import { colors, spacing, fontSize } from '../../constants';

export default function PendingApprovalScreen() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state: RootState) => state.auth);
  const { t } = useT();

  const handleCheckStatus = () => {
    if (user?.id) {
      dispatch(fetchProfile(user.id));
    }
  };

  const handleSignOut = () => {
    dispatch(signOut());
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>&#128274;</Text>
      <Text style={styles.title}>{t.accountPending}</Text>
      <Text style={styles.message}>{t.pendingMessage}</Text>

      <TouchableOpacity style={styles.checkButton} onPress={handleCheckStatus}>
        <Text style={styles.checkButtonText}>{t.checkStatus}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutButtonText}>{t.signOut}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 64,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.warning,
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xxxl,
  },
  checkButton: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxxl,
    marginBottom: spacing.lg,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  checkButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  signOutButton: {
    paddingVertical: spacing.md,
  },
  signOutButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
});
