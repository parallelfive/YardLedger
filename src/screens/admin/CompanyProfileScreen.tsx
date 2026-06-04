import { useState, useEffect } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useT } from '../../hooks/useT';
import { useAppSelector, type RootState } from '../../store';
import {
  fetchCompanySettings,
  updateCompanySettings,
  uploadCompanyLogo,
} from '../../services/companySettings';
import { colors, spacing, fontSize, borderRadius } from '../../constants';

export default function CompanyProfileScreen() {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);

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

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
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
    } catch {
      // Will show empty form
    } finally {
      setLoading(false);
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

  return (
    <ScrollView style={styles.container}>
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Text style={styles.sectionTitle}>{t.companyLogo}</Text>
        <TouchableOpacity
          style={styles.logoPicker}
          onPress={handlePickLogo}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.accent} size="large" />
          ) : logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderText}>{t.tapToAddLogo}</Text>
            </View>
          )}
        </TouchableOpacity>
        {logoUrl && <Text style={styles.logoHint}>{t.tapLogoToChange}</Text>}
      </View>

      {/* Company Info */}
      <Text style={styles.sectionTitle}>{t.companyInfo}</Text>

      <Text style={styles.label}>{t.companyNameLabel}</Text>
      <TextInput
        style={styles.input}
        placeholder={t.companyNamePlaceholder}
        placeholderTextColor={colors.textTertiary}
        value={companyName}
        onChangeText={setCompanyName}
      />

      <Text style={styles.label}>{t.addressLabel}</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        placeholder={t.addressPlaceholder}
        placeholderTextColor={colors.textTertiary}
        value={address}
        onChangeText={setAddress}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>{t.phoneLabel}</Text>
      <TextInput
        style={styles.input}
        placeholder={t.phonePlaceholder}
        placeholderTextColor={colors.textTertiary}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />

      {/* Compliance Rules */}
      <Text style={styles.sectionTitle}>{t.complianceRules}</Text>

      <Text style={styles.label}>{t.stateLabel}</Text>
      <TextInput
        style={styles.input}
        value={stateCode}
        onChangeText={setStateCode}
        autoCapitalize="characters"
        maxLength={2}
      />

      <Text style={styles.label}>{t.timezoneLabel}</Text>
      <TextInput
        style={styles.input}
        value={timezone}
        onChangeText={setTimezone}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="America/Denver"
        placeholderTextColor={colors.textTertiary}
      />

      <Text style={styles.label}>{t.generalHoldHoursLabel}</Text>
      <TextInput
        style={styles.input}
        value={generalHoldHours}
        onChangeText={setGeneralHoldHours}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t.catHoldDaysLabel}</Text>
      <TextInput
        style={styles.input}
        value={catHoldDays}
        onChangeText={setCatHoldDays}
        keyboardType="number-pad"
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>{t.catCheckOnlyLabel}</Text>
        <Switch value={catCheckOnly} onValueChange={setCatCheckOnly} />
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.saveButtonText}>{t.save}</Text>
        )}
      </TouchableOpacity>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoPicker: {
    width: 140,
    height: 140,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 140,
    height: 140,
  },
  logoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  logoPlaceholderText: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    textAlign: 'center',
    padding: spacing.md,
  },
  logoHint: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: fontSize.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: spacing.xxxl,
  },
});
