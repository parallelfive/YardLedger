import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useAppDispatch, useAppSelector, type RootState } from '../../store';
import { fetchProfile, signOut } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { colors, spacing, fontSize, fonts } from '../../constants';

export default function PendingApprovalScreen() {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state: RootState) => state.auth);
  const { t } = useT();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    if (user?.id && !checking) {
      setChecking(true);
      try {
        await dispatch(fetchProfile(user.id)).unwrap();
      } catch {
        // Profile fetch failed, stay on screen
      } finally {
        setChecking(false);
      }
    }
  };

  const handleSignOut = () => {
    dispatch(signOut());
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="lock-closed" size={36} color={colors.warning} />
      </View>
      <Text style={styles.title}>{t.accountPending}</Text>
      <Text style={styles.message}>{t.pendingMessage}</Text>

      <TouchableOpacity
        style={styles.checkButton}
        onPress={handleCheckStatus}
        disabled={checking}
      >
        {checking ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.checkButtonText}>{t.checkStatus}</Text>
        )}
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
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(176, 138, 50, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontFamily: fonts.sansBold,
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
    color: colors.accentInk,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
  signOutButton: {
    paddingVertical: spacing.md,
  },
  signOutButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
});
