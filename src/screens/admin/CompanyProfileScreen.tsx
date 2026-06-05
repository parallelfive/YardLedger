import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Switch,
  type KeyboardTypeOptions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '../../hooks/useT';
import { useRole } from '../../hooks';
import { useAppSelector, type RootState } from '../../store';
import { useCurrentCompany } from '../../hooks/useCurrentCompany';
import {
  fetchCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
} from '../../services/companySettings';
import {
  getReportingConfig,
  saveReportingConfig,
  sendReportNow,
} from '../../services/reporting';
import { useTheme, useThemedStyles } from '../../theme';
import {
  type Palette,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

// ── grouped card (uppercase title + bordered surface) ─────────
function AdmGroup({ title, children }: { title: string; children: ReactNode }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

// ── single field row inside a group (label over value) ────────
function AdmField({
  label,
  value,
  onChangeText,
  placeholder,
  mono,
  keyboardType,
  autoCapitalize,
  autoCorrect,
  multiline,
  secureTextEntry,
  maxLength,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  multiline?: boolean;
  secureTextEntry?: boolean;
  maxLength?: number;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.field, last && styles.fieldLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, mono && styles.fieldInputMono]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
      />
    </View>
  );
}

// ── switch row inside a group ─────────────────────────────────
function AdmSwitch({
  label,
  value,
  onValueChange,
  last,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.switchRow, last && styles.fieldLast]}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.accent, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export default function CompanyProfileScreen() {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  const company = useCurrentCompany();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // State-configurable compliance rules (NM defaults).
  const [stateCode, setStateCode] = useState('NM');
  const [timezone, setTimezone] = useState('America/Denver');
  const [generalHoldHours, setGeneralHoldHours] = useState('24');
  const [catHoldDays, setCatHoldDays] = useState('60');
  const [catCheckOnly, setCatCheckOnly] = useState(true);

  // State-reporting (LeadsOnline SFTP) credentials — owner only.
  const { isOwner } = useRole();
  const [repEnabled, setRepEnabled] = useState(false);
  const [repHost, setRepHost] = useState('');
  const [repPort, setRepPort] = useState('22');
  const [repUsername, setRepUsername] = useState('');
  const [repPassword, setRepPassword] = useState('');
  const [repRemoteDir, setRepRemoteDir] = useState('');
  const [repHasCreds, setRepHasCreds] = useState(false);
  const [savingReporting, setSavingReporting] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await fetchCompanySettings();
      if (data) {
        setSettingsId(data.id);
        setCompanyName(data.company_name);
        setAddress(data.address);
        setPhone(data.phone);
        setLogoUrl(data.logo_url);
        setStateCode(data.state ?? 'NM');
        setTimezone(data.timezone ?? 'America/Denver');
        setGeneralHoldHours(String(data.general_hold_hours ?? 24));
        setCatHoldDays(String(data.cat_converter_hold_days ?? 60));
        setCatCheckOnly(data.cat_converter_check_only ?? true);
      }
      if (isOwner) {
        const rep = await getReportingConfig();
        if (rep) {
          setRepEnabled(rep.enabled);
          setRepHost(rep.sftp_host);
          setRepPort(String(rep.sftp_port ?? 22));
          setRepUsername(rep.sftp_username);
          setRepRemoteDir(rep.remote_dir);
          setRepHasCreds(rep.has_credentials);
        }
      }
    } catch {
      // Will show empty form
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSaveReporting = async () => {
    setSavingReporting(true);
    try {
      await saveReportingConfig({
        sftpHost: repHost.trim(),
        sftpPort: parseInt(repPort, 10) || 22,
        sftpUsername: repUsername.trim(),
        sftpPassword: repPassword, // blank keeps the stored one
        remoteDir: repRemoteDir.trim(),
        enabled: repEnabled,
      });
      setRepPassword('');
      if (repPassword) setRepHasCreds(true);
      Alert.alert(t.success, t.reportingSaved);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSavingReporting(false);
    }
  };

  const handleSendNow = async () => {
    setSendingReport(true);
    try {
      await sendReportNow();
      Alert.alert(t.success, t.reportSent);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSendingReport(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const result = await updateCompanySettings(
        {
          company_name: companyName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          state: stateCode.trim().toUpperCase(),
          timezone: timezone.trim(),
          general_hold_hours: parseInt(generalHoldHours, 10) || 24,
          cat_converter_hold_days: parseInt(catHoldDays, 10) || 60,
          cat_converter_check_only: catCheckOnly,
        },
        profile.id,
        settingsId
      );
      if (!settingsId) setSettingsId(result.id);
      Alert.alert(t.success, t.companySettingsSaved);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickLogo = async () => {
    if (!profile) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    if (!settingsId) return;
    setUploading(true);
    try {
      const url = await uploadCompanyLogo(
        result.assets[0].uri,
        profile.id,
        settingsId
      );
      setLogoUrl(url);
      Alert.alert(t.success, t.logoUploaded);
    } catch (err) {
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Monogram initials from the prefix (e.g. "GR-2026" -> "GR") or name.
  const monogram = (
    company?.prefix?.replace(/[^A-Za-z]/g, '').slice(0, 2) ||
    companyName.replace(/[^A-Za-z]/g, '').slice(0, 2) ||
    'GR'
  ).toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Identity header — logo/monogram + name */}
      <View style={styles.identity}>
        <TouchableOpacity
          style={styles.logoTile}
          onPress={handlePickLogo}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading ? (
            <ActivityIndicator color={colors.accentInk} />
          ) : logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
          ) : (
            <Text style={styles.monogram}>{monogram}</Text>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.identityName} numberOfLines={1}>
            {companyName || company?.name || '—'}
          </Text>
          <Text style={styles.identitySub}>{company?.prefix ?? stateCode}</Text>
          <Text style={styles.logoHint}>{t.tapLogoToChange}</Text>
        </View>
      </View>

      {/* Identity */}
      <AdmGroup title={t.companyInfo}>
        <AdmField
          label={t.companyNameLabel}
          value={companyName}
          onChangeText={setCompanyName}
          placeholder={t.companyNamePlaceholder}
        />
        <AdmField
          label={t.phoneLabel}
          value={phone}
          onChangeText={setPhone}
          placeholder={t.phonePlaceholder}
          keyboardType="phone-pad"
          mono
          last
        />
      </AdmGroup>

      {/* Location */}
      <AdmGroup title={t.locationContact}>
        <AdmField
          label={t.addressLabel}
          value={address}
          onChangeText={setAddress}
          placeholder={t.addressPlaceholder}
          multiline
          last
        />
      </AdmGroup>

      {/* Compliance rules */}
      <AdmGroup title={t.complianceRules}>
        <AdmField
          label={t.stateLabel}
          value={stateCode}
          onChangeText={setStateCode}
          autoCapitalize="characters"
          maxLength={2}
          mono
        />
        <AdmField
          label={t.timezoneLabel}
          value={timezone}
          onChangeText={setTimezone}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="America/Denver"
          mono
        />
        <AdmField
          label={t.generalHoldHoursLabel}
          value={generalHoldHours}
          onChangeText={setGeneralHoldHours}
          keyboardType="number-pad"
          mono
        />
        <AdmField
          label={t.catHoldDaysLabel}
          value={catHoldDays}
          onChangeText={setCatHoldDays}
          keyboardType="number-pad"
          mono
        />
        <AdmSwitch
          label={t.catCheckOnlyLabel}
          value={catCheckOnly}
          onValueChange={setCatCheckOnly}
          last
        />
      </AdmGroup>

      <Text style={styles.footnote}>{t.profilePrintsNote}</Text>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.accentInk} />
        ) : (
          <>
            <Ionicons name="checkmark" size={18} color={colors.accentInk} />
            <Text style={styles.saveButtonText}>{t.save}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* State Reporting (owner only) — per-yard LeadsOnline SFTP credentials */}
      {isOwner && (
        <>
          <AdmGroup title={t.stateReporting}>
            <AdmSwitch
              label={t.reportingEnabled}
              value={repEnabled}
              onValueChange={setRepEnabled}
            />
            <AdmField
              label={t.sftpHost}
              value={repHost}
              onChangeText={setRepHost}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="sftp.leadsonline.com"
              mono
            />
            <AdmField
              label={t.sftpPort}
              value={repPort}
              onChangeText={setRepPort}
              keyboardType="number-pad"
              mono
            />
            <AdmField
              label={t.sftpUsername}
              value={repUsername}
              onChangeText={setRepUsername}
              autoCapitalize="none"
              autoCorrect={false}
              mono
            />
            <AdmField
              label={t.sftpPassword}
              value={repPassword}
              onChangeText={setRepPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={repHasCreds ? '•••••••• (unchanged)' : ''}
              mono
            />
            <AdmField
              label={t.sftpRemoteDir}
              value={repRemoteDir}
              onChangeText={setRepRemoteDir}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="/uploads"
              mono
              last
            />
          </AdmGroup>

          <TouchableOpacity
            style={[
              styles.saveButton,
              savingReporting && styles.saveButtonDisabled,
            ]}
            onPress={handleSaveReporting}
            disabled={savingReporting}
          >
            {savingReporting ? (
              <ActivityIndicator color={colors.accentInk} />
            ) : (
              <Text style={styles.saveButtonText}>{t.saveReportingConfig}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendNowButton,
              (sendingReport || !repEnabled) && styles.saveButtonDisabled,
            ]}
            onPress={handleSendNow}
            disabled={sendingReport || !repEnabled}
          >
            {sendingReport ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={18}
                  color={colors.accent}
                />
                <Text style={styles.sendNowButtonText}>{t.sendReportNow}</Text>
              </>
            )}
          </TouchableOpacity>
        </>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.lg,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    // ── identity header ──
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    logoTile: {
      width: 58,
      height: 58,
      borderRadius: 16,
      backgroundColor: colors.textPrimary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logoImage: { width: 58, height: 58 },
    monogram: {
      color: colors.background,
      fontSize: 22,
      fontFamily: fonts.display,
      letterSpacing: -0.5,
    },
    identityName: {
      color: colors.textPrimary,
      fontSize: 18,
      fontFamily: fonts.sansBold,
    },
    identitySub: {
      color: colors.textTertiary,
      fontSize: 11,
      fontFamily: fonts.mono,
      marginTop: 2,
    },
    logoHint: {
      color: colors.accent,
      fontSize: 11,
      fontFamily: fonts.sansMedium,
      marginTop: 4,
    },
    // ── grouped card ──
    group: { marginBottom: spacing.lg },
    groupTitle: {
      color: colors.textTertiary,
      fontSize: 10.5,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.sm,
    },
    groupCard: {
      borderRadius: borderRadius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    field: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    fieldLast: { borderBottomWidth: 0 },
    fieldLabel: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.monoSemiBold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    fieldInput: {
      color: colors.textPrimary,
      fontSize: 15,
      fontFamily: fonts.sansMedium,
      padding: 0,
    },
    fieldInputMono: {
      fontFamily: fonts.mono,
      letterSpacing: 0.3,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSubtle,
    },
    switchLabel: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: fonts.sansMedium,
      marginRight: spacing.md,
    },
    footnote: {
      color: colors.textTertiary,
      fontSize: 10,
      fontFamily: fonts.mono,
      lineHeight: 16,
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.sm,
    },
    saveButton: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: colors.accent,
      borderRadius: 14,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      color: colors.accentInk,
      fontSize: fontSize.xl,
      fontFamily: fonts.sansBold,
    },
    sendNowButton: {
      flexDirection: 'row',
      gap: spacing.sm,
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 14,
      padding: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.md,
    },
    sendNowButtonText: {
      color: colors.accent,
      fontSize: fontSize.xl,
      fontFamily: fonts.sansBold,
    },
    bottomSpacer: {
      height: spacing.xxxl,
    },
  });
