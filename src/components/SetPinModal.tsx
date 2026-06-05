import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { setPin as savePin } from '../services/pin';
import { useT } from '../hooks/useT';
import { useTheme, useThemedStyles } from '../theme';
import { spacing, borderRadius, fonts, type Palette } from '../constants';

/** Two-step keypad to set/replace the current user's 4-digit shift PIN. */
export default function SetPinModal({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [pin, setPinDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep('enter');
    setFirst('');
    setPinDigits('');
    setError(null);
    setBusy(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  const save = async (confirmed: string) => {
    setBusy(true);
    setError(null);
    try {
      await savePin(confirmed);
      onSaved?.();
      close();
    } catch (e) {
      setError((e as Error).message || t.error);
      setStep('enter');
      setFirst('');
      setPinDigits('');
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    setError(null);
    const next = (pin + d).slice(0, 4);
    setPinDigits(next);
    if (next.length === 4) {
      if (step === 'enter') {
        setTimeout(() => {
          setFirst(next);
          setPinDigits('');
          setStep('confirm');
        }, 120);
      } else {
        if (next === first) {
          save(next);
        } else {
          setTimeout(() => {
            setError(t.pinsDontMatch);
            setStep('enter');
            setFirst('');
            setPinDigits('');
          }, 120);
        }
      }
    }
  };
  const back = () => setPinDigits((p) => p.slice(0, -1));

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t.setShiftPin}</Text>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.prompt}>
            {step === 'enter' ? t.enterNewPin : t.confirmPin}
          </Text>

          <View style={styles.dots}>
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
          </View>
          <Text style={[styles.hint, error ? { color: colors.rust } : null]}>
            {busy ? t.loading : error ? error : ' '}
          </Text>

          <View style={styles.grid}>
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
                  size={24}
                  color={colors.textTertiary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.lg,
    },
    sheet: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    title: {
      fontSize: 17,
      fontFamily: fonts.sansBold,
      color: colors.textPrimary,
    },
    prompt: {
      marginTop: spacing.md,
      textAlign: 'center',
      fontSize: 12,
      fontFamily: fonts.mono,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: colors.textTertiary,
    },
    dots: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 14,
      marginTop: spacing.md,
    },
    dot: { width: 13, height: 13, borderRadius: 99, borderWidth: 1.5 },
    hint: {
      marginTop: 8,
      height: 16,
      textAlign: 'center',
      fontSize: 11,
      fontFamily: fonts.mono,
      color: colors.textTertiary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 14,
      marginTop: spacing.sm,
    },
    key: {
      width: 64,
      height: 64,
      borderRadius: 99,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    keyGhost: { backgroundColor: 'transparent', borderColor: 'transparent' },
    keyText: {
      fontSize: 25,
      fontFamily: fonts.display,
      color: colors.textPrimary,
    },
  });
