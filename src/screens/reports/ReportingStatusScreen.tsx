import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchReportingStatus,
  fetchUnreportedReceipts,
  buildNmrldExportCsv,
  markReceiptsReported,
  type ReportingStatus,
} from '../../services/reports';
import { MiniStat, SectionLabel } from '../../components/foundry';
import { useT } from '../../hooks/useT';
import { useAppSelector, type RootState } from '../../store';
import { colors, spacing, borderRadius, fonts } from '../../constants';

export default function ReportingStatusScreen() {
  const { t } = useT();
  const isFocused = useIsFocused();
  const profile = useAppSelector((s: RootState) => s.auth.profile);
  const [status, setStatus] = useState<ReportingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchReportingStatus());
    } catch {
      setStatus({ pending: 0, lastUpload: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFocused) load();
  }, [load, isFocused]);

  const handleExport = async () => {
    setSending(true);
    try {
      const unreported = await fetchUnreportedReceipts();
      if (unreported.length === 0) {
        Alert.alert(t.stateReporting, t.noUnreported);
        return;
      }
      const csv = buildNmrldExportCsv(unreported);
      const file = new File(Paths.cache, 'nmrld_unreported.csv');
      file.write(csv);
      await Sharing.shareAsync(file.uri, {
        mimeType: 'text/csv',
        UTI: 'public.comma-separated-values-text',
      });
      Alert.alert(
        t.markReportedTitle,
        t.markReportedConfirm.replace('{n}', String(unreported.length)),
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.confirm,
            onPress: async () => {
              try {
                await markReceiptsReported(
                  unreported.map((r) => r.id),
                  profile?.id ?? ''
                );
                Alert.alert(t.success, t.markedReported);
                load();
              } catch (err) {
                Alert.alert(t.error, (err as Error).message);
              }
            },
          },
        ]
      );
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (loading || !status) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const last = status.lastUpload;
  const lastDate = last
    ? new Date(last.created_at).toLocaleDateString()
    : t.neverUploaded;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.statRow}>
        <MiniStat
          label={t.pendingReports}
          value={String(status.pending)}
          sub={t.awaitingReport}
          tone={status.pending > 0 ? 'rust' : 'moss'}
          icon="cloud-upload-outline"
        />
        <MiniStat
          label={t.lastUpload}
          value={lastDate}
          sub={last ? `${last.receipt_count} · ${last.status}` : ''}
          tone="steel"
          icon="time-outline"
        />
      </View>

      <Text style={styles.note}>{t.reportDeadlineNote}</Text>

      {status.pending > 0 && (
        <TouchableOpacity
          style={[styles.button, sending && styles.buttonDisabled]}
          onPress={handleExport}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator color={colors.accentInk} />
          ) : (
            <>
              <Ionicons
                name="cloud-upload-outline"
                size={20}
                color={colors.accentInk}
              />
              <Text style={styles.buttonText}>{t.reportUnreported}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <SectionLabel>{t.stateReporting}</SectionLabel>
      <Text style={styles.body}>{t.reportingHowto}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  note: {
    color: colors.textSecondary,
    fontSize: 13,
    fontFamily: fonts.mono,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xl,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    color: colors.accentInk,
    fontSize: 16,
    fontFamily: fonts.sansBold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.sans,
    paddingHorizontal: spacing.lg,
    lineHeight: 20,
  },
});
