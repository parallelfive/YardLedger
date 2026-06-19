import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useT } from '../../hooks/useT';
import { useAppSelector, type RootState } from '../../store';
import { useCashDrawer } from '../../hooks/useCashDrawer';
import { useRefreshOnReconnect } from '../../hooks/useRefreshOnReconnect';
import { openCashDrawer, closeCashDrawer } from '../../services/cashDrawer';
import { fmtMoney } from '../../components/foundry';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';
import { useTheme, useThemedStyles } from '../../theme';

export default function CashDrawerScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const profile = useAppSelector((s: RootState) => s.auth.profile);
  const activeIdentity = useAppSelector(
    (s: RootState) => s.auth.activeIdentity
  );
  const workerId = activeIdentity?.user_id ?? profile?.id;

  const { current, history, loading, refresh } = useCashDrawer();
  const [floatInput, setFloatInput] = useState('');
  const [countInput, setCountInput] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  useRefreshOnReconnect(refresh);

  const handleOpen = async () => {
    const amount = parseFloat(floatInput);
    if (isNaN(amount) || amount < 0 || !workerId) return;
    setBusy(true);
    try {
      await openCashDrawer(amount, workerId);
      setFloatInput('');
      refresh();
    } catch (e) {
      Alert.alert(t.error, (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    const counted = parseFloat(countInput);
    if (isNaN(counted) || counted < 0 || !current || !workerId) return;
    setBusy(true);
    try {
      const result = await closeCashDrawer(current.id, counted, workerId);
      const variance = Number(result.variance ?? 0);
      const verdict =
        variance === 0
          ? t.balanced
          : `${fmtMoney(Math.abs(variance))} ${variance > 0 ? t.over : t.short}`;
      setCountInput('');
      refresh();
      Alert.alert(t.drawerClosed, verdict);
    } catch (e) {
      Alert.alert(t.error, (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {current ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t.drawerOpen}</Text>
          <Row label={t.openingFloat} value={fmtMoney(current.opening_float)} />
          <Row
            label={t.cashPaidOut}
            value={`− ${fmtMoney(current.cash_paid_out)}`}
          />
          <View style={styles.divider} />
          <Row
            label={t.expectedInDrawer}
            value={fmtMoney(current.expected_cash)}
            strong
          />

          <Text style={styles.fieldLabel}>{t.countedCash}</Text>
          <TextInput
            style={styles.input}
            value={countInput}
            onChangeText={setCountInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
          />
          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleClose}
            disabled={busy || countInput.trim() === ''}
          >
            <Text style={styles.buttonText}>{t.closeDrawer}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t.openDrawer}</Text>
          <Text style={styles.hint}>{t.openDrawerHint}</Text>
          <Text style={styles.fieldLabel}>{t.openingFloat}</Text>
          <TextInput
            style={styles.input}
            value={floatInput}
            onChangeText={setFloatInput}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
          />
          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={handleOpen}
            disabled={busy || floatInput.trim() === ''}
          >
            <Text style={styles.buttonText}>{t.openDrawer}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.sectionTitle}>{t.closeoutHistory}</Text>
      {history.length === 0 ? (
        <Text style={styles.empty}>{t.noCloseouts}</Text>
      ) : (
        history.map((h) => {
          const v = Number(h.variance ?? 0);
          const vColor =
            v === 0 ? colors.textSecondary : v > 0 ? colors.moss : colors.rust;
          const vLabel =
            v === 0
              ? t.balanced
              : `${fmtMoney(Math.abs(v))} ${v > 0 ? t.over : t.short}`;
          return (
            <View key={h.id} style={styles.histRow}>
              <View>
                <Text style={styles.histDate}>
                  {h.closed_at
                    ? new Date(h.closed_at).toLocaleDateString()
                    : ''}
                </Text>
                <Text style={styles.histSub}>
                  {fmtMoney(Number(h.counted_cash ?? 0))} {t.countedCash} ·{' '}
                  {fmtMoney(Number(h.expected_cash ?? 0))} {t.expectedShort}
                </Text>
              </View>
              <Text style={[styles.histVariance, { color: vColor }]}>
                {vLabel}
              </Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>
        {value}
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: spacing.lg, gap: spacing.lg },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      marginBottom: spacing.md,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    rowLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
    },
    rowValue: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    rowValueStrong: {
      color: colors.accent,
      fontSize: fontSize.xl,
      fontFamily: fonts.sansBold,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.sm,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sansSemiBold,
      marginTop: spacing.lg,
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      fontSize: fontSize.xl,
      fontFamily: fonts.sans,
      borderWidth: 1,
      borderColor: colors.border,
    },
    button: {
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.accent,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      color: colors.accentInk,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: fontSize.lg,
      fontFamily: fonts.sansBold,
    },
    empty: {
      color: colors.textTertiary,
      fontSize: fontSize.md,
      fontFamily: fonts.sans,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    histRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
    },
    histDate: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontFamily: fonts.sansSemiBold,
    },
    histSub: {
      color: colors.textSecondary,
      fontSize: fontSize.sm,
      fontFamily: fonts.sans,
      marginTop: 2,
    },
    histVariance: {
      fontSize: fontSize.md,
      fontFamily: fonts.sansBold,
    },
  });
