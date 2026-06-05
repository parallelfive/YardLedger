// Tare counter sign-in — a shared yard terminal where staff sign in by PIN.
// Presentational: the parent wires `onSubmit(pin, role)` to the real auth once
// the passcode auth model is decided (see PR notes). UI ported from the Tare
// design handoff (screen-login.jsx).
import { useRef, useState } from 'react';
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
import { TareMark, Wordmark } from '../../components';
import { useT } from '../../hooks/useT';
import { useTheme, useThemedStyles } from '../../theme';
import { spacing, fonts, type Palette } from '../../constants';

export type TareRole = 'worker' | 'admin' | 'owner';

interface Props {
  companyName: string;
  /** Initials shown in the avatar for the selected role/user. */
  userInitials?: string;
  userName?: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (pin: string, role: TareRole) => void;
}

const ROLES: { key: TareRole; label: string }[] = [
  { key: 'worker', label: 'Worker' },
  { key: 'admin', label: 'Admin' },
  { key: 'owner', label: 'Owner' },
];

export default function PasscodeLoginScreen({
  companyName,
  userInitials = 'TR',
  userName,
  busy,
  error,
  onSubmit,
}: Props) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const [role, setRole] = useState<TareRole>('admin');
  const [pin, setPin] = useState('');
  const shake = useRef(new Animated.Value(0)).current;

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

  const press = (d: string) => {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      onSubmit(next, role);
      // Clear shortly after so a wrong PIN resets the dots (parent sets error).
      setTimeout(() => {
        setPin('');
        runShake();
      }, 240);
    }
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 56 }]}>
      <View style={styles.ambient} />

      {/* Brand lockup */}
      <TareMark size={64} radius={18} />
      <View style={{ marginTop: spacing.lg }}>
        <Wordmark size={34} />
      </View>
      <Text style={styles.tagline}>{t.appTagline}</Text>

      {/* Yard context */}
      <View style={styles.companyChip}>
        <View style={styles.companyAvatar}>
          <Text style={styles.companyAvatarText}>
            {companyName.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.companyName}>{companyName}</Text>
      </View>

      {/* Who's signing in */}
      <View style={styles.userBlock}>
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>{userInitials}</Text>
        </View>
        {userName ? <Text style={styles.userName}>{userName}</Text> : null}
        <View style={styles.roleRow}>
          {ROLES.map((r) => {
            const active = role === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                onPress={() => {
                  setRole(r.key);
                  setPin('');
                }}
                style={[styles.rolePill, active && styles.rolePillActive]}
              >
                <Text
                  style={[
                    styles.rolePillText,
                    active && styles.rolePillTextActive,
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
          const c = error ? colors.rust : colors.accent;
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
        {busy ? '' : error ? error : t.enterPasscode}
      </Text>

      {/* Keypad */}
      <View style={[styles.keypad, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.keyGrid}>
          {keys.map((n) => (
            <TouchableOpacity
              key={n}
              style={styles.key}
              onPress={() => press(n)}
              disabled={busy}
            >
              <Text style={styles.keyText}>{n}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.key} />
          <TouchableOpacity
            style={styles.key}
            onPress={() => press('0')}
            disabled={busy}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.key, styles.keyGhost]}
            onPress={back}
            disabled={busy}
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
      </View>
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
    ambient: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 240,
      backgroundColor: colors.accentMuted,
    },
    tagline: {
      marginTop: 6,
      fontSize: 11.5,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.textTertiary,
      fontFamily: fonts.mono,
    },
    companyChip: {
      marginTop: 26,
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
    userBlock: { marginTop: 24, alignItems: 'center' },
    userAvatar: {
      width: 54,
      height: 54,
      borderRadius: 99,
      backgroundColor: colors.accentMuted,
      borderWidth: 1,
      borderColor: colors.accentLine,
      alignItems: 'center',
      justifyContent: 'center',
    },
    userAvatarText: {
      fontSize: 19,
      fontFamily: fonts.display,
      color: colors.accent,
    },
    userName: {
      marginTop: 10,
      fontSize: 16,
      fontFamily: fonts.sansSemiBold,
      color: colors.textPrimary,
    },
    roleRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
    rolePill: {
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 99,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    rolePillActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    rolePillText: {
      fontSize: 11.5,
      fontFamily: fonts.sansSemiBold,
      color: colors.textSecondary,
    },
    rolePillTextActive: { color: colors.accentInk },
    dotsRow: {
      marginTop: 22,
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
    keyGhost: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    },
    keyText: {
      fontSize: 27,
      fontFamily: fonts.display,
      color: colors.textPrimary,
    },
  });
