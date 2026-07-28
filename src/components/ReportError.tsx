import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../hooks/useT';
import { useTheme, useThemedStyles } from '../theme';
import { type Palette, spacing, borderRadius, fonts } from '../constants';

// Shown when a report/data load FAILS (vs. legitimately having no data). The
// report screens used to swallow the error and render an empty state, so a
// failed fetch looked like "nothing to show" (#106). This makes the failure
// explicit and offers a retry.
export default function ReportError({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.wrap}>
      <Ionicons
        name="cloud-offline-outline"
        size={34}
        color={colors.textTertiary}
      />
      <Text style={styles.title}>{t.couldNotLoad}</Text>
      <Text style={styles.sub}>{t.checkConnectionRetry}</Text>
      <TouchableOpacity
        style={styles.btn}
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Ionicons name="reload" size={16} color={colors.accent} />
        <Text style={styles.btnText}>{t.retry}</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.sm,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 15.5,
      fontFamily: fonts.sansSemiBold,
      marginTop: spacing.sm,
    },
    sub: {
      color: colors.textTertiary,
      fontSize: 13,
      fontFamily: fonts.sans,
      textAlign: 'center',
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginTop: spacing.md,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.accentLine,
      backgroundColor: colors.accentMuted,
    },
    btnText: {
      color: colors.accent,
      fontSize: 14,
      fontFamily: fonts.sansSemiBold,
    },
  });
