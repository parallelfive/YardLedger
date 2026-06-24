import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../constants';
import { useThemedStyles } from '../theme';

export interface SnackAction {
  label: string;
  onPress: () => void;
}

interface SnackbarProps {
  visible: boolean;
  message: string;
  actions?: SnackAction[];
  onDismiss: () => void;
  autoHideMs?: number;
}

// Lightweight bottom snackbar: a non-blocking confirmation with optional inline
// actions, auto-dismissing after a few seconds. Absolute-positioned so it never
// disturbs the screen beneath it.
export default function Snackbar({
  visible,
  message,
  actions = [],
  onDismiss,
  autoHideMs = 6000,
}: SnackbarProps) {
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();

  // Keep onDismiss in a ref so the auto-hide timer isn't reset by parent
  // re-renders that hand us a new callback identity.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => dismissRef.current(), autoHideMs);
    return () => clearTimeout(id);
  }, [visible, autoHideMs]);

  if (!visible) return null;

  return (
    <View
      style={[styles.wrap, { paddingBottom: insets.bottom + spacing.sm }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        <Text style={styles.msg} numberOfLines={2}>
          {message}
        </Text>
        {actions.map((a) => (
          <TouchableOpacity
            key={a.label}
            onPress={a.onPress}
            style={styles.action}
          >
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      zIndex: 2000,
    },
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      width: '100%',
      maxWidth: 520,
      backgroundColor: colors.textPrimary,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    msg: {
      flex: 1,
      color: colors.background,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
    },
    action: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
    actionText: {
      color: colors.accent,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansBold,
    },
  });
