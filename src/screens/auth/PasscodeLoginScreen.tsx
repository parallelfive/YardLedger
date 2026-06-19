// Tare counter sign-in — each staffer has their OWN PIN. The PIN identifies the
// user and signs in as them; their role comes with them. No role picker — you
// can only unlock the profile whose passcode you know. Ported from the updated
// Tare design handoff (screen-login.jsx + Auth Model Change).
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TareMark, Wordmark, ResponsiveContainer } from '../../components';
import { useT } from '../../hooks/useT';
import { useTheme, useThemedStyles } from '../../theme';
import { spacing, fonts, type Palette } from '../../constants';

export type TareRole = 'worker' | 'admin' | 'owner';

interface Props {
  companyName: string;
  busy?: boolean;
  error?: string | null;
  /** Set once a PIN resolves a person — shows them briefly before sign-in. */
  resolved?: { name: string; role: TareRole } | null;
  onSubmit: (pin: string) => void;
  /** Bumped by the parent on each failed attempt → clears the dots + shakes. */
  failNonce?: number;
  /** Escape hatch — sign the device out back to the email/invite login. */
  onSignOut?: () => void;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const roleLabel = (role: TareRole, t: ReturnType<typeof useT>['t']) =>
  role === 'owner' ? t.roleOwner : role === 'admin' ? t.admin : t.worker;

export default function PasscodeLoginScreen({
  companyName,
  busy,
  error,
  resolved,
  onSubmit,
  failNonce = 0,
  onSignOut,
}: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

  const ok = !!resolved;
  // Permission ring: moss = can manage (admin/owner), gold = worker.
  const ring = ok
    ? resolved.role === 'worker'
      ? colors.gold
      : colors.moss
    : colors.accent;

  const runShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: -1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 1,
        duration: 60,
        useNativeDriver: true,
      }),
      Animated.timing(shake, {
        toValue: 0,
        duration: 60,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // On a failed attempt the parent bumps failNonce → clear the dots and shake.
  useEffect(() => {
    if (failNonce > 0) {
      setPin('');
      runShake();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failNonce]);

  const press = (d: string) => {
    if (busy || ok) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) onSubmit(next);
  };
  const back = () => {
    if (!ok) setPin((p) => p.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 48 }]}>
      <View style={styles.ambient} />

      <ResponsiveContainer maxWidth={420} style={styles.body}>
        {/* Brand lockup */}
        <TareMark size={62} radius={18} />
        <View style={{ marginTop: spacing.lg }}>
          <Wordmark size={32} />
        </View>

        {/* Yard context */}
        <View style={styles.companyChip}>
          <View style={styles.companyAvatar}>
            <Text style={styles.companyAvatarText}>
              {companyName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.companyName} numberOfLines={1}>
            {companyName}
          </Text>
        </View>

        {/* Identity slot — neutral until a valid PIN resolves a person */}
        <View style={styles.identity}>
          <View
            style={[
              styles.idAvatar,
              {
                backgroundColor: ok ? ring + '28' : colors.surface,
                borderColor: ok ? ring : colors.borderStrong,
              },
            ]}
          >
            {ok ? (
              <Text style={[styles.idInitials, { color: ring }]}>
                {initialsOf(resolved.name)}
              </Text>
            ) : (
              <Ionicons
                name="lock-closed"
                size={24}
                color={colors.textTertiary}
              />
            )}
          </View>
          <Text style={styles.idName}>
            {ok ? resolved.name : t.terminalLocked}
          </Text>
          <Text
            style={[
              styles.idSub,
              ok
                ? {
                    color: ring,
                    textTransform: 'uppercase',
                    fontFamily: fonts.monoSemiBold,
                  }
                : null,
            ]}
          >
            {ok ? roleLabel(resolved.role, t) : t.enterPasscodeToSignIn}
          </Text>
        </View>

        {/* PIN dots */}
        <Animated.View
          style={[
            styles.dotsRow,
            {
              transform: [
                {
                  translateX: shake.interpolate({
                    inputRange: [-1, 1],
                    outputRange: [-9, 9],
                  }),
                },
              ],
            },
          ]}
        >
          {[0, 1, 2, 3].map((i) => {
            const filled = i < pin.length;
            const c = error ? colors.rust : ring;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: filled ? c : 'transparent',
                    borderColor: filled ? c : colors.borderStrong,
                  },
                ]}
              />
            );
          })}
        </Animated.View>
        <Text style={[styles.hint, error ? { color: colors.rust } : null]}>
          {busy ? '' : error ? error : ' '}
        </Text>

        {/* Keypad */}
        <View style={[styles.keypad, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.keyGrid}>
            {keys.map((n) => (
              <TouchableOpacity
                key={n}
                style={styles.key}
                onPress={() => press(n)}
                disabled={busy || ok}
              >
                <Text style={styles.keyText}>{n}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.key} />
            <TouchableOpacity
              style={styles.key}
              onPress={() => press('0')}
              disabled={busy || ok}
            >
              <Text style={styles.keyText}>0</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.key, styles.keyGhost]}
              onPress={back}
              disabled={busy || ok}
            >
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons
                  name="backspace-outline"
                  size={26}
                  color={colors.textTertiary}
                />
              )}
            </TouchableOpacity>
          </View>
          {onSignOut ? (
            <TouchableOpacity
              style={styles.signOut}
              onPress={onSignOut}
              disabled={busy}
            >
              <Ionicons
                name="log-out-outline"
                size={14}
                color={colors.textTertiary}
              />
              <Text style={styles.signOutText}>{t.signOutDevice}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ResponsiveContainer>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      paddingHorizontal: 28,
    },
    body: {
      flex: 1,
      alignItems: 'center',
    },
    ambient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 240,
      backgroundColor: colors.accentMuted,
    },
    companyChip: {
      marginTop: 22,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      paddingLeft: 9,
      paddingRight: 14,
      borderRadius: 99,
      backgroundColor: colors.chip,
      borderWidth: 1,
      borderColor: colors.border,
    },
    companyAvatar: {
      width: 24,
      height: 24,
      borderRadius: 7,
      backgroundColor: colors.textPrimary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companyAvatarText: {
      color: colors.background,
      fontSize: 11,
      fontFamily: fonts.display,
    },
    companyName: {
      fontSize: 13.5,
      fontFamily: fonts.sansSemiBold,
      color: colors.textSecondary,
    },
    identity: { marginTop: 30, alignItems: 'center', height: 96 },
    idAvatar: {
      width: 56,
      height: 56,
      borderRadius: 99,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    idInitials: { fontSize: 20, fontFamily: fonts.display },
    idName: {
      marginTop: 11,
      fontSize: 16,
      fontFamily: fonts.sansBold,
      color: colors.textPrimary,
    },
    idSub: {
      marginTop: 3,
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textTertiary,
      fontFamily: fonts.mono,
    },
    dotsRow: {
      marginTop: 6,
      flexDirection: 'row',
      gap: 14,
      height: 16,
      alignItems: 'center',
    },
    dot: { width: 13, height: 13, borderRadius: 99, borderWidth: 1.5 },
    hint: {
      marginTop: 10,
      fontSize: 11,
      letterSpacing: 0.4,
      color: colors.textTertiary,
      fontFamily: fonts.mono,
      height: 16,
    },
    keypad: { marginTop: 'auto', width: '100%', paddingHorizontal: 10 },
    keyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 16,
    },
    key: {
      width: 70,
      height: 70,
      borderRadius: 99,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
    keyText: {
      fontSize: 27,
      fontFamily: fonts.display,
      color: colors.textPrimary,
    },
    signOut: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 16,
      paddingVertical: 6,
    },
    signOutText: {
      fontSize: 11.5,
      color: colors.textTertiary,
      fontFamily: fonts.mono,
      letterSpacing: 0.3,
    },
  });
