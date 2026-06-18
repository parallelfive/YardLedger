import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector, type RootState } from '../store';
import { useT } from '../hooks/useT';
import { type Palette, spacing, fontSize, fonts } from '../constants';
import { useThemedStyles } from '../theme';

// Thin top overlay shown while the device is offline, or while queued offline
// transactions are still waiting to sync. Absolute-positioned so it never
// disturbs screen layout; renders nothing in the normal online/empty case.
export default function OfflineBanner() {
  const isOnline = useAppSelector((s: RootState) => s.app.isOnline);
  const pending = useAppSelector((s: RootState) => s.app.pendingOutbox);
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const styles = useThemedStyles(makeStyles);

  if (isOnline && pending === 0) return null;

  const offline = !isOnline;
  const label = offline
    ? pending > 0
      ? `${t.offlineBanner} · ${pending} ${t.queuedSuffix}`
      : t.offlineBanner
    : `${t.syncingQueued} (${pending})`;

  return (
    <View
      style={[
        styles.bar,
        offline ? styles.barOffline : styles.barSyncing,
        { paddingTop: insets.top + spacing.xs },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    bar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      paddingBottom: spacing.xs,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
    },
    barOffline: {
      backgroundColor: colors.danger,
    },
    barSyncing: {
      backgroundColor: colors.accent,
    },
    text: {
      color: '#fff',
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
    },
  });
