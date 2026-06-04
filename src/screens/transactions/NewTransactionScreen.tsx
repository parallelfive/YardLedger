import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  Image,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { AccessCodeModal, SignaturePad } from '../../components';
import AddMaterialKeypad from '../../components/AddMaterialKeypad';
import type { SignaturePadHandle } from '../../components/SignaturePad';
import {
  MetalDot,
  Tag,
  SectionLabel,
  fmtMoney,
  fmtLbs,
  type Tone,
} from '../../components/foundry';
import { useT } from '../../hooks/useT';
import { useNewTransaction } from '../../hooks/useNewTransaction';
import { useIdScanner } from '../../hooks/useIdScanner';
import type { Metal } from '../../types';
import {
  searchCustomers,
  updateCustomerIdPhoto,
  type Customer,
} from '../../services/customers';
import {
  colors,
  spacing,
  fontSize,
  borderRadius,
  fonts,
} from '../../constants';

type Props = NativeStackScreenProps<
  TransactionsStackParamList,
  'NewTransaction'
>;

interface SavedReceipt {
  id: string;
  total: number;
  customerName: string;
  itemCount: number;
}

type Tier = 'open' | 'regulated' | 'restricted' | 'catalytic';
type StepName = 'materials' | 'seller' | 'vehicle' | 'converter' | 'review';

export default function NewTransactionScreen({ navigation }: Props) {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const tx = useNewTransaction(signaturePadRef);
  const { scanning: scanningId, scanAndRecognize } = useIdScanner();

  const [step, setStep] = useState(0);
  const [printAfterSave, setPrintAfterSave] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState<SavedReceipt | null>(null);
  const [customerResults, setCustomers] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | undefined
  >();
  // Override coming from the AddMaterial keypad — applied through the existing
  // AccessCodeModal flow once the new line item lands in state.
  const [pendingOverride, setPendingOverride] = useState<{
    index: number;
    price: number;
  } | null>(null);

  // Governing tier (strictest material wins) — drives which steps appear.
  const tier: Tier | null =
    tx.lineItems.length === 0
      ? null
      : tx.hasCatalyticConverter
        ? 'catalytic'
        : tx.hasRestrictedMetal
          ? 'restricted'
          : tx.hasRegulatedMetal
            ? 'regulated'
            : 'open';

  // The buy adapts to what was weighed — the compliance engine, made visible.
  const steps = useMemo<StepName[]>(() => {
    if (!tier || tier === 'open') return ['materials', 'review'];
    const s: StepName[] = ['materials', 'seller', 'vehicle'];
    if (tier === 'catalytic') s.push('converter');
    s.push('review');
    return s;
  }, [tier]);

  useEffect(() => {
    if (step > steps.length - 1) setStep(steps.length - 1);
  }, [steps.length, step]);

  // Stage the keypad override: once the new line item exists and the hook's
  // override price matches, route it through requestOverride (opens the
  // AccessCodeModal). approveOverride then writes it back, tracked per line.
  useEffect(() => {
    if (!pendingOverride) return;
    if (tx.overridePrice !== String(pendingOverride.price)) return;
    tx.requestOverride(pendingOverride.index);
    setPendingOverride(null);
  }, [pendingOverride, tx]);

  const tierMeta = (tr: Tier | null) => {
    switch (tr) {
      case 'catalytic':
        return {
          tone: colors.rust,
          label: t.tierCatalytic,
          note: t.tierCatalyticNote,
          icon: 'shield-outline' as const,
        };
      case 'restricted':
        return {
          tone: colors.rust,
          label: t.tierRestricted,
          note: t.tierRestrictedNote,
          icon: 'shield-outline' as const,
        };
      case 'regulated':
        return {
          tone: colors.gold,
          label: t.tierRegulated,
          note: t.tierRegulatedNote,
          icon: 'alert-circle-outline' as const,
        };
      case 'open':
        return {
          tone: colors.moss,
          label: t.tierOpen,
          note: t.tierOpenNote,
          icon: 'checkmark-circle-outline' as const,
        };
      default:
        return {
          tone: colors.textTertiary,
          label: t.emptyCart,
          note: t.complianceEmptyNote,
          icon: 'cube-outline' as const,
        };
    }
  };

  const handleCustomerSearch = useCallback(async () => {
    const query = tx.customerName.trim();
    if (!query) return;
    setSearchingCustomers(true);
    try {
      const results = await searchCustomers(query);
      setCustomers(results);
      setShowCustomers(true);
    } catch {
      // silently fail — user can still type manually
    } finally {
      setSearchingCustomers(false);
    }
  }, [tx.customerName]);

  const handleSelectCustomer = useCallback(
    (customer: Customer) => {
      if (customer.is_flagged) {
        Alert.alert(t.flagWarning, customer.flag_reason || t.flagCustomer, [
          { text: t.ok },
        ]);
      }
      tx.setCustomerName(customer.name);
      tx.setCustomerPhone(customer.phone ?? '');
      setSelectedCustomerId(customer.id);
      setShowCustomers(false);
      setCustomers([]);
    },
    [tx, t.flagWarning, t.flagCustomer, t.ok]
  );

  // Add a line item from the keypad sheet, staging any authorized override.
  const handleAddMaterial = useCallback(
    (metal: Metal, weight: number, overridePrice: number | null) => {
      const newIndex = tx.lineItems.length;
      tx.addLineItem(metal, weight);
      setShowAddSheet(false);
      if (overridePrice != null) {
        tx.startPriceEdit(newIndex);
        tx.setOverridePrice(String(overridePrice));
        setPendingOverride({ index: newIndex, price: overridePrice });
      }
    },
    [tx]
  );

  const handleSaveSuccess = useCallback(
    async (
      receiptId: string,
      customerId: string,
      sellerIdPhotoUrl: string | null
    ) => {
      if (sellerIdPhotoUrl && customerId) {
        try {
          await updateCustomerIdPhoto(customerId, sellerIdPhotoUrl);
        } catch {
          // Non-blocking — receipt is already saved
        }
      }
      if (printAfterSave) {
        tx.resetForm();
        navigation.popToTop();
        navigation.navigate('ReceiptDetail', { receiptId, printOnLoad: true });
      } else {
        setSavedReceipt({
          id: receiptId,
          total: tx.receiptTotal,
          customerName: tx.customerName,
          itemCount: tx.lineItems.length,
        });
      }
    },
    [printAfterSave, tx, navigation]
  );

  const handleNewTicket = useCallback(
    (keepCustomer: boolean) => {
      tx.resetForm(keepCustomer);
      setSavedReceipt(null);
      setStep(0);
      if (!keepCustomer) setSelectedCustomerId(undefined);
    },
    [tx]
  );

  const handleViewReceipt = useCallback(() => {
    if (!savedReceipt) return;
    const receiptId = savedReceipt.id;
    setSavedReceipt(null);
    tx.resetForm();
    setStep(0);
    navigation.popToTop();
    navigation.navigate('ReceiptDetail', {
      receiptId,
      printOnLoad: printAfterSave,
    });
  }, [savedReceipt, navigation, printAfterSave, tx]);

  const handleClose = useCallback(() => {
    if (tx.lineItems.length > 0) {
      Alert.alert(t.discardBuyTitle, t.discardBuyMessage, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.discard,
          style: 'destructive',
          onPress: () => {
            tx.resetForm();
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  }, [
    tx,
    navigation,
    t.discardBuyTitle,
    t.discardBuyMessage,
    t.cancel,
    t.discard,
  ]);

  // NM 57-30-5(C) — fresh date/time-stamped camera shot.
  const capturePhoto = useCallback(
    async (setUri: (uri: string) => void) => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.error, t.cameraPermission);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) setUri(result.assets[0].uri);
    },
    [t.error, t.cameraPermission]
  );

  const scanSellerId = useCallback(async () => {
    const result = await scanAndRecognize();
    if (!result) return;
    tx.setSellerIdPhotoUri(result.imageUri);
    if (result.fields.name && !tx.sellerName.trim())
      tx.setSellerName(result.fields.name);
    if (result.fields.driversLicense && !tx.sellerDlNumber.trim())
      tx.setSellerDlNumber(result.fields.driversLicense);
    if (result.fields.dob && !tx.sellerDob.trim())
      tx.setSellerDob(result.fields.dob);
    if (result.fields.address && !tx.sellerAddress.trim())
      tx.setSellerAddress(result.fields.address);
  }, [scanAndRecognize, tx]);

  // Step gating
  const canAdvance = (name: StepName): boolean => {
    switch (name) {
      case 'materials':
        return tx.lineItems.length > 0 && !!tx.customerName.trim();
      case 'seller':
        return !!tx.sellerName.trim() && !!tx.sellerDlNumber.trim();
      case 'vehicle':
        return !!tx.vehiclePlate.trim();
      case 'converter':
        return tx.transportVin.trim().length === 17;
      case 'review':
        return tier === 'open' ? true : tx.sellerAffirmed;
      default:
        return true;
    }
  };

  const current = steps[Math.min(step, steps.length - 1)];
  const isLast = step === steps.length - 1;
  const isStepped = steps.length > 2;
  const meta = tierMeta(tier);
  const payMethodLabel = tx.hasCatalyticConverter
    ? t.paymentCheck
    : tx.paymentMethod === 'cash'
      ? t.paymentCash
      : tx.paymentMethod === 'check'
        ? t.paymentCheck
        : t.paymentOther;

  const stepTitle =
    current === 'materials'
      ? t.materialsTitle
      : current === 'seller'
        ? t.sellerIdInfo
        : current === 'vehicle'
          ? t.vehicleInfo
          : current === 'converter'
            ? t.catConverterSection
            : t.reviewTitle;

  return (
    <View style={styles.flex}>
      {/* ── Overlay header: eyebrow + title + close + progress ── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTopRow}>
          <View style={styles.flex}>
            <Text style={styles.headerEyebrow}>
              {isStepped
                ? t.stepXofN
                    .replace('{step}', String(step + 1))
                    .replace('{total}', String(steps.length))
                : t.newBuyTitle}
            </Text>
            <Text style={styles.headerTitle}>{stepTitle}</Text>
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        {isStepped && (
          <View style={styles.progressBar}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.progressSeg,
                  {
                    backgroundColor: i <= step ? colors.accent : colors.border,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Compliance banner (live read of what the cart requires) ── */}
        <View
          style={[
            styles.banner,
            {
              borderColor: meta.tone + '47',
              backgroundColor: meta.tone + '17',
            },
          ]}
        >
          <View
            style={[styles.bannerIcon, { backgroundColor: meta.tone + '28' }]}
          >
            <Ionicons name={meta.icon} size={18} color={meta.tone} />
          </View>
          <View style={styles.flex}>
            <View style={styles.bannerTitleRow}>
              <Text style={styles.bannerTitle}>{meta.label}</Text>
              <Tag label="NM" color={meta.tone} soft={meta.tone + '22'} />
            </View>
            <Text style={styles.bannerNote}>{meta.note}</Text>
          </View>
        </View>

        {/* ── MATERIALS ─────────────────────────────────────────── */}
        {current === 'materials' && (
          <>
            <View style={styles.totalDisplay}>
              <Text style={styles.totalEyebrow}>{t.runningTotal}</Text>
              <Text style={styles.totalBig}>{fmtMoney(tx.receiptTotal)}</Text>
              <Text style={styles.totalSub}>
                {fmtLbs(tx.lineItems.reduce((s, i) => s + Number(i.weight), 0))}{' '}
                lb · {tx.lineItems.length}{' '}
                {tx.lineItems.length === 1 ? t.line : t.lines}
              </Text>
            </View>

            {tx.lineItems.map((item, index) => {
              const itemTone: Tone =
                item.isCatalytic || item.isRestricted
                  ? 'rust'
                  : item.isRegulated
                    ? 'gold'
                    : 'moss';
              return (
                <View
                  key={index}
                  style={[
                    styles.lineItemRow,
                    (item.isRestricted || item.isCatalytic) &&
                      styles.lineItemRestricted,
                  ]}
                >
                  <MetalDot tone={itemTone} size={11} />
                  <View style={styles.lineItemInfo}>
                    <View style={styles.lineItemHeader}>
                      <Text style={styles.lineItemName}>{item.metalName}</Text>
                      {item.isPriceOverride && (
                        <Text style={styles.overrideBadge}>{t.override}</Text>
                      )}
                    </View>
                    {tx.editingIndex === index ? (
                      <View style={styles.editPriceRow}>
                        <TextInput
                          style={styles.editPriceInput}
                          value={tx.overridePrice}
                          onChangeText={tx.setOverridePrice}
                          keyboardType="decimal-pad"
                          autoFocus
                        />
                        <TouchableOpacity
                          style={styles.editPriceConfirm}
                          onPress={() => tx.requestOverride(index)}
                        >
                          <Text style={styles.editPriceConfirmText}>
                            {t.ok}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.editPriceCancel}
                          onPress={tx.cancelEdit}
                        >
                          <Ionicons
                            name="close"
                            size={16}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => tx.startPriceEdit(index)}
                      >
                        <Text style={styles.lineItemDetail}>
                          {Number(item.weight).toFixed(2)} lb @{' '}
                          {fmtMoney(Number(item.pricePerLb))}/lb
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.lineItemTotal}>
                    {fmtMoney(item.total)}
                  </Text>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert(t.removeItem, t.removeItemConfirm, [
                        { text: t.cancel, style: 'cancel' },
                        {
                          text: t.remove,
                          style: 'destructive',
                          onPress: () => tx.removeLineItem(index),
                        },
                      ])
                    }
                    style={styles.removeButton}
                  >
                    <Ionicons
                      name="close"
                      size={16}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.addLineItemButton}
              onPress={() => setShowAddSheet(true)}
            >
              <Ionicons name="add" size={19} color={colors.accent} />
              <Text style={styles.addLineItemButtonText}>{t.addMaterial}</Text>
            </TouchableOpacity>

            {tx.lineItems.length > 0 && (
              <Text style={styles.hintText}>{t.tapPriceToOverride}</Text>
            )}

            {/* Customer */}
            <SectionLabel>{t.customerInfo}</SectionLabel>
            <View style={styles.customerSearchRow}>
              <TextInput
                style={[styles.input, styles.customerNameInput]}
                placeholder={`${t.customerName} *`}
                placeholderTextColor={colors.textTertiary}
                value={tx.customerName}
                onChangeText={(text) => {
                  tx.setCustomerName(text);
                  setSelectedCustomerId(undefined);
                  if (showCustomers) setShowCustomers(false);
                }}
                onSubmitEditing={handleCustomerSearch}
                returnKeyType="search"
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={styles.customerSearchButton}
                onPress={handleCustomerSearch}
                disabled={searchingCustomers || !tx.customerName.trim()}
              >
                {searchingCustomers ? (
                  <ActivityIndicator color={colors.accentInk} size="small" />
                ) : (
                  <Ionicons name="search" size={18} color={colors.accentInk} />
                )}
              </TouchableOpacity>
            </View>
            {showCustomers && (
              <View style={styles.customerResultsContainer}>
                {customerResults.length === 0 ? (
                  <Text style={styles.noCustomersText}>
                    {t.noCustomersFound}
                  </Text>
                ) : (
                  customerResults.map((c, i) => (
                    <TouchableOpacity
                      key={`${c.id}-${i}`}
                      style={styles.customerResultRow}
                      onPress={() => handleSelectCustomer(c)}
                    >
                      <Text style={styles.customerResultName}>{c.name}</Text>
                      <View style={styles.customerResultDetails}>
                        {c.phone ? (
                          <Text style={styles.customerResultPhone}>
                            {c.phone}
                          </Text>
                        ) : null}
                        {c.drivers_license ? (
                          <Text style={styles.customerResultDl}>
                            {t.dlNumberShort} {c.drivers_license}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
            <TextInput
              style={styles.input}
              placeholder={t.phoneNumber}
              placeholderTextColor={colors.textTertiary}
              value={tx.customerPhone}
              onChangeText={tx.setCustomerPhone}
              keyboardType="phone-pad"
            />
          </>
        )}

        {/* ── SELLER ────────────────────────────────────────────── */}
        {current === 'seller' && (
          <>
            {tx.sellerIdPhotoUri ? (
              <View style={styles.idPhotoPreview}>
                <Image
                  source={{ uri: tx.sellerIdPhotoUri }}
                  style={styles.idPhotoImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.rescanButton}
                  disabled={scanningId}
                  onPress={scanSellerId}
                >
                  <Text style={styles.rescanButtonText}>{t.updateId}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.scanIdButton}
                disabled={scanningId}
                onPress={scanSellerId}
              >
                <Ionicons name="scan-outline" size={20} color={colors.accent} />
                <Text style={styles.scanIdButtonText}>{t.scanId}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.orEnterManually}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TextInput
              style={styles.input}
              placeholder={`${t.sellerFullName} *`}
              placeholderTextColor={colors.textTertiary}
              value={tx.sellerName}
              onChangeText={tx.setSellerName}
              autoCapitalize="words"
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder={`${t.sellerDlNumber} *`}
                placeholderTextColor={colors.textTertiary}
                value={tx.sellerDlNumber}
                onChangeText={tx.setSellerDlNumber}
              />
              <TextInput
                style={[styles.input, styles.shortInput]}
                placeholder={t.sellerStateOfIssue}
                placeholderTextColor={colors.textTertiary}
                value={tx.sellerStateOfIssue}
                onChangeText={tx.setSellerStateOfIssue}
                autoCapitalize="characters"
                maxLength={2}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder={t.sellerDateOfBirth}
              placeholderTextColor={colors.textTertiary}
              value={tx.sellerDob}
              onChangeText={tx.setSellerDob}
            />
            <TextInput
              style={styles.input}
              placeholder={t.sellerAddress}
              placeholderTextColor={colors.textTertiary}
              value={tx.sellerAddress}
              onChangeText={tx.setSellerAddress}
              autoCapitalize="words"
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder={t.sellerCity}
                placeholderTextColor={colors.textTertiary}
                value={tx.sellerCity}
                onChangeText={tx.setSellerCity}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, styles.shortInput]}
                placeholder={t.sellerState}
                placeholderTextColor={colors.textTertiary}
                value={tx.sellerState}
                onChangeText={tx.setSellerState}
                autoCapitalize="characters"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.shortInput]}
                placeholder={t.sellerZip}
                placeholderTextColor={colors.textTertiary}
                value={tx.sellerZip}
                onChangeText={tx.setSellerZip}
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
          </>
        )}

        {/* ── VEHICLE ───────────────────────────────────────────── */}
        {current === 'vehicle' && (
          <>
            <View style={styles.infoBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.accent}
              />
              <Text style={styles.infoBannerText}>{t.vehicleRequiredNote}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={`${t.vehiclePlate} *`}
              placeholderTextColor={colors.textTertiary}
              value={tx.vehiclePlate}
              onChangeText={tx.setVehiclePlate}
              autoCapitalize="characters"
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.shortInput]}
                placeholder={t.vehicleYear}
                placeholderTextColor={colors.textTertiary}
                value={tx.vehicleYear}
                onChangeText={tx.setVehicleYear}
                keyboardType="number-pad"
                maxLength={4}
              />
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder={t.vehicleMake}
                placeholderTextColor={colors.textTertiary}
                value={tx.vehicleMake}
                onChangeText={tx.setVehicleMake}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder={t.vehicleModel}
                placeholderTextColor={colors.textTertiary}
                value={tx.vehicleModel}
                onChangeText={tx.setVehicleModel}
                autoCapitalize="words"
              />
              <TextInput
                style={[styles.input, styles.flexInput]}
                placeholder={t.vehicleColor}
                placeholderTextColor={colors.textTertiary}
                value={tx.vehicleColor}
                onChangeText={tx.setVehicleColor}
                autoCapitalize="words"
              />
            </View>
          </>
        )}

        {/* ── CONVERTER (catalytic) ─────────────────────────────── */}
        {current === 'converter' && (
          <>
            <View style={styles.lockBanner}>
              <Ionicons name="lock-closed" size={17} color={colors.rust} />
              <Text style={styles.lockBannerText}>{t.catCheckOnlyNote}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder={`${t.transportVin} *`}
              placeholderTextColor={colors.textTertiary}
              value={tx.transportVin}
              onChangeText={(v) => tx.setTransportVin(v.toUpperCase())}
              autoCapitalize="characters"
              maxLength={17}
            />
            <TextInput
              style={styles.input}
              placeholder={t.catConverterNumbers}
              placeholderTextColor={colors.textTertiary}
              value={tx.catConverterNumbers}
              onChangeText={tx.setCatConverterNumbers}
            />
            <View style={styles.photoRow}>
              <PhotoTile
                uri={tx.catConverterPhotoUri}
                label={t.catConverterPhoto}
                onPress={() => capturePhoto(tx.setCatConverterPhotoUri)}
              />
              <PhotoTile
                uri={tx.catTitlePhotoUri}
                label={t.catTitlePhoto}
                onPress={() => capturePhoto(tx.setCatTitlePhotoUri)}
              />
            </View>
          </>
        )}

        {/* ── REVIEW ────────────────────────────────────────────── */}
        {current === 'review' && (
          <>
            <View style={styles.reviewCard}>
              <View style={styles.reviewSellerRow}>
                <Text style={styles.reviewEyebrow}>
                  {tier === 'open' ? t.customerInfo : t.sellerIdInfo}
                </Text>
                <Text style={styles.reviewSellerName}>
                  {tier === 'open'
                    ? tx.customerName || t.walkIn
                    : tx.sellerName || '—'}
                </Text>
                {tier !== 'open' && !!tx.sellerDlNumber && (
                  <Text style={styles.reviewSellerSub}>
                    {tx.sellerDlNumber}
                    {tx.sellerStateOfIssue ? ` (${tx.sellerStateOfIssue})` : ''}
                  </Text>
                )}
              </View>
              {tx.lineItems.map((item, i) => (
                <View key={i} style={styles.reviewItemRow}>
                  <Text style={styles.reviewItemName}>{item.metalName}</Text>
                  <Text style={styles.reviewItemWeight}>
                    {Number(item.weight).toFixed(2)} lb
                  </Text>
                  <Text style={styles.reviewItemTotal}>
                    {fmtMoney(item.total)}
                  </Text>
                </View>
              ))}
              <View style={styles.reviewTotalRow}>
                <Text style={styles.reviewTotalLabel}>{t.totalPayout}</Text>
                <Text style={styles.reviewTotalValue}>
                  {fmtMoney(tx.receiptTotal)}
                </Text>
              </View>
            </View>

            {tier && tier !== 'open' && (
              <View style={styles.noticeRow}>
                <Ionicons name="time-outline" size={18} color={colors.gold} />
                <Text style={styles.noticeText}>
                  {tier === 'catalytic' ? t.holdNotice60 : t.holdNotice24}
                </Text>
              </View>
            )}
            {tier && tier !== 'open' && (
              <View style={styles.reportNotice}>
                <Ionicons
                  name="cloud-upload-outline"
                  size={18}
                  color={colors.gold}
                />
                <Text style={styles.noticeText}>{t.reportQueuedNote}</Text>
              </View>
            )}

            {/* Payment method */}
            <SectionLabel>{t.paymentMethodLabel}</SectionLabel>
            <View style={styles.paymentRow}>
              {(['cash', 'check', 'other'] as const).map((m) => {
                const locked = tx.hasCatalyticConverter;
                const active = locked ? m === 'check' : tx.paymentMethod === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.paymentOption,
                      active && styles.paymentOptionActive,
                      locked && m !== 'check' && styles.paymentOptionDisabled,
                    ]}
                    disabled={locked}
                    onPress={() => tx.setPaymentMethod(m)}
                  >
                    {locked && m === 'check' && (
                      <Ionicons
                        name="lock-closed"
                        size={12}
                        color={colors.accent}
                      />
                    )}
                    <Text
                      style={[
                        styles.paymentOptionText,
                        active && styles.paymentOptionTextActive,
                      ]}
                    >
                      {m === 'cash'
                        ? t.paymentCash
                        : m === 'check'
                          ? t.paymentCheck
                          : t.paymentOther}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {tx.hasCatalyticConverter && (
              <Text style={styles.paymentNote}>{t.catCheckOnlyNote}</Text>
            )}

            {/* Seller & material photos (regulated+) */}
            {tier !== 'open' && (
              <View style={styles.photoRow}>
                <PhotoTile
                  uri={tx.sellerPhotoUri}
                  label={t.sellerPhoto}
                  onPress={() => capturePhoto(tx.setSellerPhotoUri)}
                />
                <PhotoTile
                  uri={tx.materialPhotoUri}
                  label={t.materialPhoto}
                  onPress={() => capturePhoto(tx.setMaterialPhotoUri)}
                />
              </View>
            )}

            <SignaturePad
              ref={signaturePadRef}
              onSignatureChange={tx.setSignature}
              label={t.customerSignature}
              clearLabel={t.clear}
            />

            {tier !== 'open' && (
              <TouchableOpacity
                style={styles.affirmationRow}
                onPress={() => tx.setSellerAffirmed(!tx.sellerAffirmed)}
              >
                <View
                  style={[
                    styles.checkbox,
                    tx.sellerAffirmed && styles.checkboxChecked,
                  ]}
                >
                  {tx.sellerAffirmed && (
                    <Ionicons
                      name="checkmark"
                      size={15}
                      color={colors.accentInk}
                    />
                  )}
                </View>
                <Text style={styles.affirmationText}>
                  {t.sellerAffirmation}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Footer: Back + Continue/Pay ───────────────────────── */}
      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.md },
        ]}
      >
        {step > 0 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setStep(step - 1)}
          >
            <Text style={styles.backButtonText}>{t.back}</Text>
          </TouchableOpacity>
        )}
        {isLast ? (
          <View style={styles.flex}>
            <View style={styles.payRow}>
              <TouchableOpacity
                style={[
                  styles.payButton,
                  styles.payButtonOutline,
                  (!canAdvance('review') || tx.saving) &&
                    styles.payButtonDisabled,
                ]}
                onPress={() => {
                  setPrintAfterSave(false);
                  tx.saveReceipt(handleSaveSuccess, selectedCustomerId);
                }}
                disabled={!canAdvance('review') || tx.saving}
              >
                {tx.saving && !printAfterSave ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Text style={styles.payButtonOutlineText}>
                    {t.pay} {fmtMoney(tx.receiptTotal)}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.payButton,
                  styles.payButtonPrimary,
                  (!canAdvance('review') || tx.saving) &&
                    styles.payButtonDisabled,
                ]}
                onPress={() => {
                  setPrintAfterSave(true);
                  tx.saveReceipt(handleSaveSuccess, selectedCustomerId);
                }}
                disabled={!canAdvance('review') || tx.saving}
              >
                {tx.saving && printAfterSave ? (
                  <ActivityIndicator color={colors.accentInk} />
                ) : (
                  <>
                    <Ionicons
                      name="print-outline"
                      size={18}
                      color={colors.accentInk}
                    />
                    <Text style={styles.payButtonText}>{t.saveAndPrint}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.payHint}>
              {payMethodLabel} · {tx.lineItems.length}{' '}
              {tx.lineItems.length === 1 ? t.line : t.lines}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.continueButton,
              !canAdvance(current) && styles.payButtonDisabled,
            ]}
            onPress={() => setStep(step + 1)}
            disabled={!canAdvance(current)}
          >
            <Text style={styles.continueButtonText}>{t.continueLabel}</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={
                canAdvance(current) ? colors.accentInk : colors.textTertiary
              }
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Add material sheet (pick + keypad) ────────────────── */}
      <Modal
        visible={showAddSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setShowAddSheet(false)}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <View style={styles.sheetGrabber} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t.addMaterial}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowAddSheet(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <AddMaterialKeypad onAdd={handleAddMaterial} />
          </View>
        </View>
      </Modal>

      {/* Quick-mode success modal */}
      <Modal
        visible={!!savedReceipt}
        transparent
        animationType="fade"
        onRequestClose={handleViewReceipt}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={36} color={colors.white} />
            </View>
            <Text style={styles.successTitle}>{t.receiptSaved}</Text>
            {savedReceipt && (
              <View style={styles.successSummary}>
                <Text style={styles.successCustomer}>
                  {savedReceipt.customerName}
                </Text>
                <Text style={styles.successDetail}>
                  {savedReceipt.itemCount}{' '}
                  {savedReceipt.itemCount === 1 ? 'item' : t.items} ·{' '}
                  {fmtMoney(savedReceipt.total)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.quickModeButton}
              onPress={() => handleNewTicket(false)}
            >
              <Text style={styles.quickModeButtonText}>{t.newTicket}</Text>
            </TouchableOpacity>
            {savedReceipt && (
              <TouchableOpacity
                style={styles.quickModeSameCustomer}
                onPress={() => handleNewTicket(true)}
              >
                <Text style={styles.quickModeSameCustomerText}>
                  {t.newTicketSameCustomer}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.viewReceiptButton}
              onPress={handleViewReceipt}
            >
              <Text style={styles.viewReceiptButtonText}>{t.viewReceipt}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <AccessCodeModal
        visible={tx.showCodeModal}
        onSuccess={tx.approveOverride}
        onCancel={tx.cancelOverride}
      />
    </View>
  );
}

// ── small reusable photo capture tile ──────────────────────────
function PhotoTile({
  uri,
  label,
  onPress,
}: {
  uri: string | null;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.photoTile} onPress={onPress}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.photoTileImage}
          resizeMode="cover"
        />
      ) : (
        <>
          <Ionicons name="camera-outline" size={22} color={colors.accent} />
          <Text style={styles.photoTileLabel}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },

  // Overlay header
  header: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  headerEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
    marginTop: 3,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: { flexDirection: 'row', gap: 5, marginTop: spacing.md },
  progressSeg: { flex: 1, height: 4, borderRadius: 99 },

  // Compliance banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  bannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  bannerTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.sansBold,
  },
  bannerNote: {
    color: colors.textSecondary,
    fontSize: 11.5,
    fontFamily: fonts.mono,
    marginTop: 2,
    lineHeight: 16,
  },

  // Running total display
  totalDisplay: { alignItems: 'center', paddingVertical: spacing.md },
  totalEyebrow: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  totalBig: {
    color: colors.textPrimary,
    fontSize: 52,
    fontFamily: fonts.display,
    letterSpacing: -1.5,
    marginTop: spacing.xs,
  },
  totalSub: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fonts.mono,
    marginTop: 4,
  },

  // Line items
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  lineItemRestricted: { borderColor: colors.rust + '4d' },
  lineItemInfo: { flex: 1 },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineItemName: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  overrideBadge: {
    color: colors.danger,
    fontSize: 10,
    fontFamily: fonts.sansBold,
    backgroundColor: colors.rust + '26',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  lineItemDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.mono,
    marginTop: 2,
  },
  lineItemTotal: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.monoSemiBold,
  },
  removeButton: { padding: spacing.xs },
  editPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  editPriceInput: {
    backgroundColor: colors.background,
    color: colors.textPrimary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: fontSize.md,
    fontFamily: fonts.mono,
    borderWidth: 1,
    borderColor: colors.accent,
    minWidth: 90,
  },
  editPriceConfirm: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editPriceConfirmText: {
    color: colors.accentInk,
    fontFamily: fonts.monoSemiBold,
    fontSize: fontSize.sm,
  },
  editPriceCancel: { paddingHorizontal: spacing.sm, paddingVertical: 6 },

  addLineItemButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentMuted,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.accentLine,
    borderStyle: 'dashed',
  },
  addLineItemButtonText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontFamily: fonts.sansBold,
  },
  hintText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fonts.sans,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Inputs
  input: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    fontSize: fontSize.lg,
    fontFamily: fonts.sans,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowInputs: { flexDirection: 'row', gap: spacing.sm },
  flexInput: { flex: 1 },
  shortInput: { width: 80 },
  customerSearchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  customerNameInput: { flex: 1 },
  customerSearchButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    height: 50,
    justifyContent: 'center',
  },
  customerResultsContainer: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    maxHeight: 200,
  },
  customerResultRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  customerResultName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  customerResultDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  customerResultPhone: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
  customerResultDl: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    fontFamily: fonts.sans,
  },
  noCustomersText: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
    padding: spacing.md,
    textAlign: 'center',
  },

  // Dividers / banners
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSubtle },
  dividerText: {
    color: colors.textTertiary,
    fontSize: 10.5,
    fontFamily: fonts.mono,
    letterSpacing: 0.8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accentMuted,
    marginBottom: spacing.lg,
  },
  infoBannerText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fonts.sans,
    lineHeight: 17,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.rust + '17',
    borderWidth: 1,
    borderColor: colors.rust + '42',
    marginBottom: spacing.lg,
  },
  lockBannerText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.sans,
    lineHeight: 17,
  },

  // Photos
  photoRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  photoTile: {
    flex: 1,
    height: 96,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.accentLine,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  photoTileImage: { width: '100%', height: '100%' },
  photoTileLabel: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontFamily: fonts.sansSemiBold,
  },
  scanIdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.accentLine,
    borderStyle: 'dashed',
  },
  scanIdButtonText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  idPhotoPreview: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  idPhotoImage: { width: '100%', height: 180, backgroundColor: colors.card },
  rescanButton: {
    padding: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  rescanButtonText: {
    color: colors.accent,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },

  // Review
  reviewCard: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  reviewSellerRow: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  reviewEyebrow: {
    color: colors.textTertiary,
    fontSize: 10.5,
    fontFamily: fonts.monoSemiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  reviewSellerName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
    marginTop: 2,
  },
  reviewSellerSub: {
    color: colors.textTertiary,
    fontSize: 11.5,
    fontFamily: fonts.mono,
    marginTop: 2,
  },
  reviewItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  reviewItemName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.sans,
  },
  reviewItemWeight: {
    color: colors.textTertiary,
    fontSize: 11.5,
    fontFamily: fonts.mono,
    marginRight: spacing.md,
  },
  reviewItemTotal: {
    color: colors.textPrimary,
    fontSize: 14,
    fontFamily: fonts.monoSemiBold,
  },
  reviewTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.surface2,
  },
  reviewTotalLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontFamily: fonts.sansBold,
  },
  reviewTotalValue: {
    color: colors.accent,
    fontSize: 22,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.sm,
  },
  reportNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gold + '17',
    borderWidth: 1,
    borderColor: colors.gold + '42',
    marginBottom: spacing.lg,
  },
  noticeText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fonts.sans,
    lineHeight: 17,
  },

  // Payment
  paymentRow: { flexDirection: 'row', gap: spacing.sm },
  paymentOption: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  paymentOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  paymentOptionDisabled: { opacity: 0.45 },
  paymentOptionText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  paymentOptionTextActive: { color: colors.accent },
  paymentNote: {
    color: colors.rust,
    fontSize: fontSize.sm,
    fontFamily: fonts.mono,
    marginTop: spacing.xs,
  },

  // Affirmation
  affirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginTop: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  affirmationText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 12.5,
    fontFamily: fonts.sans,
    lineHeight: 17,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.background,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backButtonText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  continueButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 15,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.accent,
  },
  continueButtonText: {
    color: colors.accentInk,
    fontSize: 16,
    fontFamily: fonts.sansBold,
  },
  payRow: { flexDirection: 'row', gap: spacing.sm },
  payButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 15,
    borderRadius: borderRadius.lg,
  },
  payButtonPrimary: { backgroundColor: colors.accent },
  payButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  payButtonDisabled: { opacity: 0.4 },
  payButtonText: {
    color: colors.accentInk,
    fontSize: 15,
    fontFamily: fonts.sansBold,
  },
  payButtonOutlineText: {
    color: colors.accent,
    fontSize: 15,
    fontFamily: fonts.sansBold,
  },
  payHint: {
    color: colors.textTertiary,
    fontSize: 11,
    fontFamily: fonts.mono,
    textAlign: 'center',
    marginTop: 6,
  },

  // Add material sheet
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    maxHeight: '90%',
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontFamily: fonts.display,
    letterSpacing: -0.5,
  },

  // Success modal
  successOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  successModal: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  successTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
    marginBottom: spacing.md,
  },
  successSummary: { alignItems: 'center', marginBottom: spacing.lg },
  successCustomer: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  successDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.mono,
    marginTop: spacing.xs,
  },
  quickModeButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickModeButtonText: {
    color: colors.accentInk,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansBold,
  },
  quickModeSameCustomer: {
    backgroundColor: 'transparent',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickModeSameCustomerText: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  viewReceiptButton: {
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  viewReceiptButtonText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.sans,
  },
});
