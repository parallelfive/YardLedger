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
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionsStackParamList } from '../../navigation/MainNavigator';
import { useState, useRef, useCallback } from 'react';
import { Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  AccessCodeModal,
  SignaturePad,
  AddLineItemModal,
} from '../../components';
import type { SignaturePadHandle } from '../../components/SignaturePad';
import { useT } from '../../hooks/useT';
import { useNewTransaction } from '../../hooks/useNewTransaction';
import { useIdScanner } from '../../hooks/useIdScanner';
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

export default function NewTransactionScreen({ navigation }: Props) {
  const { t } = useT();
  const signaturePadRef = useRef<SignaturePadHandle>(null);
  const tx = useNewTransaction(signaturePadRef);
  const [printAfterSave, setPrintAfterSave] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState<SavedReceipt | null>(null);
  const [customerResults, setCustomers] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<
    string | undefined
  >();
  const { scanning: scanningId, scanAndRecognize } = useIdScanner();

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

  const handleSaveSuccess = useCallback(
    async (
      receiptId: string,
      customerId: string,
      sellerIdPhotoUrl: string | null
    ) => {
      // Link the already-uploaded photo to the customer profile
      if (sellerIdPhotoUrl && customerId) {
        try {
          await updateCustomerIdPhoto(customerId, sellerIdPhotoUrl);
        } catch {
          // Non-blocking — receipt is already saved
        }
      }

      if (printAfterSave) {
        tx.resetForm();
        // Pop back to list, then push detail so back button returns to list
        navigation.popToTop();
        navigation.navigate('ReceiptDetail', {
          receiptId,
          printOnLoad: true,
        });
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
      if (!keepCustomer) {
        setSelectedCustomerId(undefined);
      }
    },
    [tx]
  );

  // NM 57-30-5(C) seller/material photos — take a fresh camera shot.
  const capturePhoto = useCallback(
    async (setUri: (uri: string) => void) => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t.error, 'Camera permission required');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) setUri(result.assets[0].uri);
    },
    [t.error]
  );

  const handleViewReceipt = useCallback(() => {
    if (!savedReceipt) return;
    const receiptId = savedReceipt.id;
    setSavedReceipt(null);
    tx.resetForm();
    // Pop back to list, then push detail so back button returns to list
    navigation.popToTop();
    navigation.navigate('ReceiptDetail', {
      receiptId,
      printOnLoad: printAfterSave,
    });
  }, [savedReceipt, navigation, printAfterSave, tx]);

  return (
    <>
      <ScrollView style={styles.container}>
        <Text style={styles.sectionTitle}>{t.customerInfo}</Text>
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
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.customerSearchButtonText}>{t.search}</Text>
            )}
          </TouchableOpacity>
        </View>
        {showCustomers && (
          <View style={styles.customerResultsContainer}>
            {customerResults.length === 0 ? (
              <Text style={styles.noCustomersText}>{t.noCustomersFound}</Text>
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
                      <Text style={styles.customerResultPhone}>{c.phone}</Text>
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

        <TouchableOpacity
          style={styles.addLineItemButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addLineItemButtonText}>{t.addLineItem}</Text>
        </TouchableOpacity>

        {tx.lineItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>{t.lineItems}</Text>
            <Text style={styles.hintText}>{t.tapPriceToOverride}</Text>
            {tx.lineItems.map((item, index) => (
              <View key={index} style={styles.lineItemRow}>
                <View style={styles.lineItemInfo}>
                  <View style={styles.lineItemHeader}>
                    <Text style={styles.lineItemName}>{item.metalName}</Text>
                    {item.isPriceOverride && (
                      <Text style={styles.overrideBadge}>{t.override}</Text>
                    )}
                  </View>

                  {tx.editingIndex === index ? (
                    <View style={styles.editPriceRow}>
                      <Text style={styles.editPriceLabel}>{t.pricePerLb}</Text>
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
                        <Text style={styles.editPriceConfirmText}>OK</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.editPriceCancel}
                        onPress={tx.cancelEdit}
                      >
                        <Text style={styles.editPriceCancelText}>X</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity onPress={() => tx.startPriceEdit(index)}>
                      <Text style={styles.lineItemDetail}>
                        {Number(item.weight).toFixed(2)} lbs @{' '}
                        <Text
                          style={
                            item.isPriceOverride
                              ? styles.overridePrice
                              : undefined
                          }
                        >
                          ${Number(item.pricePerLb).toFixed(4)}/lb
                        </Text>
                        {item.isPriceOverride && (
                          <Text style={styles.originalPrice}>
                            {' '}
                            (was ${Number(item.originalPricePerLb).toFixed(4)}
                            /lb)
                          </Text>
                        )}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.lineItemTotal}>
                  ${item.total.toFixed(2)}
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
                  <Text style={styles.removeButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t.receiptTotal}</Text>
          <Text style={styles.totalValue}>${tx.receiptTotal.toFixed(2)}</Text>
        </View>

        {/* Payment method (catalytic converters are forced to check) */}
        <Text style={styles.sectionTitle}>{t.paymentMethodLabel}</Text>
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

        {/* Tier 2: Regulated Materials — Seller ID + Vehicle + Ownership */}
        {tx.hasRegulatedMetal && (
          <>
            <View style={styles.regulatedBanner}>
              <Text style={styles.regulatedBannerText}>
                {t.regulatedWarning}
              </Text>
            </View>

            {/* Tier 3: Restricted Material Warnings */}
            {tx.hasRestrictedMetal && (
              <View style={styles.restrictedBanner}>
                <Text style={styles.restrictedBannerText}>
                  {t.restrictedWarning}
                </Text>
                <View style={styles.restrictedNotes}>
                  <Text style={styles.restrictedNoteItem}>
                    {t.restrictedBurntWire}
                  </Text>
                  <Text style={styles.restrictedNoteItem}>
                    {t.restrictedIdRemoved}
                  </Text>
                  <Text style={styles.restrictedNoteItem}>
                    {t.restrictedPropertyOf}
                  </Text>
                  <Text style={styles.restrictedNoteItem}>
                    {t.restrictedInfrastructure}
                  </Text>
                  <Text style={styles.restrictedNoteItem}>
                    {t.restrictedBeerKeg}
                  </Text>
                  <Text style={styles.restrictedNoteItem}>
                    {t.restrictedCatalyticConverter}
                  </Text>
                </View>
              </View>
            )}

            {/* Seller Identification */}
            <Text style={styles.sectionTitle}>{t.sellerIdInfo}</Text>

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
                  onPress={async () => {
                    const result = await scanAndRecognize();
                    if (!result) return;
                    tx.setSellerIdPhotoUri(result.imageUri);
                    if (result.fields.name && !tx.sellerName.trim())
                      tx.setSellerName(result.fields.name);
                    if (
                      result.fields.driversLicense &&
                      !tx.sellerDlNumber.trim()
                    )
                      tx.setSellerDlNumber(result.fields.driversLicense);
                    if (result.fields.dob && !tx.sellerDob.trim())
                      tx.setSellerDob(result.fields.dob);
                    if (result.fields.address && !tx.sellerAddress.trim())
                      tx.setSellerAddress(result.fields.address);
                  }}
                >
                  <Text style={styles.rescanButtonText}>{t.updateId}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.scanIdButton}
                disabled={scanningId}
                onPress={async () => {
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
                }}
              >
                <Ionicons name="camera" size={20} color={colors.accent} />
                <Text style={styles.scanIdButtonText}>{t.scanId}</Text>
              </TouchableOpacity>
            )}

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

            {/* Vehicle Info */}
            <Text style={styles.sectionTitle}>{t.vehicleInfo}</Text>
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

            {/* Catalytic Converter Additional Documentation */}
            {tx.hasCatalyticConverter && (
              <>
                <Text style={styles.sectionTitle}>{t.catConverterSection}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.catConverterNumbers}
                  placeholderTextColor={colors.textTertiary}
                  value={tx.catConverterNumbers}
                  onChangeText={tx.setCatConverterNumbers}
                />
                <TextInput
                  style={styles.input}
                  placeholder={`${t.transportVin} *`}
                  placeholderTextColor={colors.textTertiary}
                  value={tx.transportVin}
                  onChangeText={tx.setTransportVin}
                  autoCapitalize="characters"
                  maxLength={17}
                />

                {/* Photo of catalytic converter */}
                {tx.catConverterPhotoUri ? (
                  <View style={styles.idPhotoPreview}>
                    <Image
                      source={{ uri: tx.catConverterPhotoUri }}
                      style={styles.idPhotoImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={styles.rescanButton}
                      onPress={async () => {
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ['images'],
                          quality: 0.8,
                        });
                        if (!result.canceled)
                          tx.setCatConverterPhotoUri(result.assets[0].uri);
                      }}
                    >
                      <Text style={styles.rescanButtonText}>
                        {t.catConverterPhoto}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.scanIdButton}
                    onPress={async () => {
                      const { status } =
                        await ImagePicker.requestCameraPermissionsAsync();
                      if (status !== 'granted') {
                        Alert.alert(t.error, 'Camera permission required');
                        return;
                      }
                      const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ['images'],
                        quality: 0.8,
                      });
                      if (!result.canceled)
                        tx.setCatConverterPhotoUri(result.assets[0].uri);
                    }}
                  >
                    <Ionicons name="camera" size={20} color={colors.accent} />
                    <Text style={styles.scanIdButtonText}>
                      {t.catConverterPhoto}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Photo of title/registration */}
                {tx.catTitlePhotoUri ? (
                  <View style={styles.idPhotoPreview}>
                    <Image
                      source={{ uri: tx.catTitlePhotoUri }}
                      style={styles.idPhotoImage}
                      resizeMode="contain"
                    />
                    <TouchableOpacity
                      style={styles.rescanButton}
                      onPress={async () => {
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ['images'],
                          quality: 0.8,
                        });
                        if (!result.canceled)
                          tx.setCatTitlePhotoUri(result.assets[0].uri);
                      }}
                    >
                      <Text style={styles.rescanButtonText}>
                        {t.catTitlePhoto}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.scanIdButton}
                    onPress={async () => {
                      const { status } =
                        await ImagePicker.requestCameraPermissionsAsync();
                      if (status !== 'granted') {
                        Alert.alert(t.error, 'Camera permission required');
                        return;
                      }
                      const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ['images'],
                        quality: 0.8,
                      });
                      if (!result.canceled)
                        tx.setCatTitlePhotoUri(result.assets[0].uri);
                    }}
                  >
                    <Ionicons name="camera" size={20} color={colors.accent} />
                    <Text style={styles.scanIdButtonText}>
                      {t.catTitlePhoto}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Seller & material photos (NM 57-30-5(C)) */}
            {tx.sellerPhotoUri ? (
              <View style={styles.idPhotoPreview}>
                <Image
                  source={{ uri: tx.sellerPhotoUri }}
                  style={styles.idPhotoImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.rescanButton}
                  onPress={() => capturePhoto(tx.setSellerPhotoUri)}
                >
                  <Text style={styles.rescanButtonText}>{t.sellerPhoto}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.scanIdButton}
                onPress={() => capturePhoto(tx.setSellerPhotoUri)}
              >
                <Ionicons name="camera" size={20} color={colors.accent} />
                <Text style={styles.scanIdButtonText}>{t.sellerPhoto}</Text>
              </TouchableOpacity>
            )}

            {tx.materialPhotoUri ? (
              <View style={styles.idPhotoPreview}>
                <Image
                  source={{ uri: tx.materialPhotoUri }}
                  style={styles.idPhotoImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={styles.rescanButton}
                  onPress={() => capturePhoto(tx.setMaterialPhotoUri)}
                >
                  <Text style={styles.rescanButtonText}>{t.materialPhoto}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.scanIdButton}
                onPress={() => capturePhoto(tx.setMaterialPhotoUri)}
              >
                <Ionicons name="camera" size={20} color={colors.accent} />
                <Text style={styles.scanIdButtonText}>{t.materialPhoto}</Text>
              </TouchableOpacity>
            )}

            {/* Ownership Affirmation */}
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
                {tx.sellerAffirmed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.affirmationText}>{t.sellerAffirmation}</Text>
            </TouchableOpacity>
          </>
        )}

        <SignaturePad
          ref={signaturePadRef}
          onSignatureChange={tx.setSignature}
          label={t.customerSignature}
          clearLabel={t.clear}
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              styles.saveButtonOutline,
              (tx.lineItems.length === 0 || tx.saving) &&
                styles.saveButtonDisabled,
            ]}
            onPress={() => {
              setPrintAfterSave(false);
              tx.saveReceipt(handleSaveSuccess, selectedCustomerId);
            }}
            disabled={tx.lineItems.length === 0 || tx.saving}
          >
            {tx.saving && !printAfterSave ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.saveButtonOutlineText}>{t.saveReceipt}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.saveButton,
              styles.saveButtonPrimary,
              (tx.lineItems.length === 0 || tx.saving) &&
                styles.saveButtonDisabled,
            ]}
            onPress={() => {
              setPrintAfterSave(true);
              tx.saveReceipt(handleSaveSuccess, selectedCustomerId);
            }}
            disabled={tx.lineItems.length === 0 || tx.saving}
          >
            {tx.saving && printAfterSave ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>{t.saveAndPrint}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

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
              <Text style={styles.successIcon}>✓</Text>
            </View>
            <Text style={styles.successTitle}>{t.receiptSaved}</Text>
            {savedReceipt && (
              <View style={styles.successSummary}>
                <Text style={styles.successCustomer}>
                  {savedReceipt.customerName}
                </Text>
                <Text style={styles.successDetail}>
                  {savedReceipt.itemCount}{' '}
                  {savedReceipt.itemCount === 1 ? 'item' : t.items} — $
                  {savedReceipt.total.toFixed(2)}
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

      <AddLineItemModal
        visible={showAddModal}
        onAdd={(metal, weight, weightData) => {
          tx.addLineItem(metal, weight, weightData);
          setShowAddModal(false);
        }}
        onClose={() => setShowAddModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.sansSemiBold,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  hintText: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
    marginTop: -spacing.sm,
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
  customerSearchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  customerNameInput: {
    flex: 1,
  },
  customerSearchButton: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    marginBottom: spacing.md,
  },
  customerSearchButtonText: {
    color: colors.background,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
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
  },
  customerResultDl: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
  },
  noCustomersText: {
    color: colors.textTertiary,
    fontSize: fontSize.md,
    padding: spacing.md,
    textAlign: 'center',
  },
  addLineItemButton: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  addLineItemButtonText: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  lineItemInfo: {
    flex: 1,
  },
  lineItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lineItemName: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  overrideBadge: {
    color: colors.danger,
    fontSize: fontSize.xs,
    fontFamily: fonts.sansBold,
    backgroundColor: 'rgba(248, 81, 73, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  lineItemDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  overridePrice: {
    color: colors.danger,
    fontFamily: fonts.monoSemiBold,
  },
  originalPrice: {
    color: colors.textTertiary,
    fontSize: fontSize.xs,
    fontFamily: fonts.mono,
    textDecorationLine: 'line-through',
  },
  editPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  editPriceLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
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
    minWidth: 80,
  },
  editPriceConfirm: {
    backgroundColor: colors.accent,
    borderRadius: borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editPriceConfirmText: {
    color: colors.background,
    fontFamily: fonts.monoSemiBold,
    fontSize: fontSize.sm,
  },
  editPriceCancel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  editPriceCancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.monoSemiBold,
    fontSize: fontSize.sm,
  },
  lineItemTotal: {
    color: colors.accent,
    fontSize: fontSize.lg,
    fontFamily: fonts.monoSemiBold,
    marginRight: spacing.md,
  },
  removeButton: {
    padding: spacing.sm,
  },
  removeButtonText: {
    color: colors.danger,
    fontSize: fontSize.md,
    fontFamily: fonts.sansBold,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paymentOption: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
  },
  paymentOptionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.inputBackground,
  },
  paymentOptionDisabled: {
    opacity: 0.4,
  },
  paymentOptionText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  paymentOptionTextActive: {
    color: colors.accent,
  },
  paymentNote: {
    color: colors.textTertiary,
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  totalLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontFamily: fonts.sansSemiBold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  totalValue: {
    color: colors.accent,
    fontSize: 30,
    fontFamily: fonts.monoSemiBold,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  saveButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  saveButtonPrimary: {
    backgroundColor: colors.accent,
  },
  saveButtonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: colors.background,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
  saveButtonOutlineText: {
    color: colors.accent,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
  },
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
  successIcon: {
    color: '#ffffff',
    fontSize: 32,
    fontFamily: fonts.sansBold,
  },
  successTitle: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontFamily: fonts.sansBold,
    marginBottom: spacing.md,
  },
  successSummary: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successCustomer: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontFamily: fonts.sansSemiBold,
  },
  successDetail: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
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
    color: colors.background,
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
    borderWidth: 1,
    borderColor: colors.accent,
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
  idPhotoImage: {
    width: '100%',
    height: 180,
    backgroundColor: colors.card,
  },
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
  affirmationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkmark: {
    color: colors.background,
    fontSize: fontSize.sm,
    fontFamily: fonts.sansBold,
  },
  affirmationText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    flex: 1,
  },
  regulatedBanner: {
    backgroundColor: 'rgba(176, 138, 50, 0.10)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(176, 138, 50, 0.40)',
  },
  regulatedBannerText: {
    color: colors.gold,
    fontSize: fontSize.md,
    fontFamily: fonts.sansSemiBold,
  },
  restrictedBanner: {
    backgroundColor: 'rgba(181, 70, 47, 0.12)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(181, 70, 47, 0.40)',
  },
  restrictedBannerText: {
    color: colors.rust,
    fontSize: fontSize.md,
    fontFamily: fonts.sansBold,
    marginBottom: spacing.sm,
  },
  restrictedNotes: {
    gap: spacing.xs,
  },
  restrictedNoteItem: {
    color: colors.warning,
    fontSize: fontSize.sm,
    paddingLeft: spacing.sm,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flexInput: {
    flex: 1,
  },
  shortInput: {
    width: 80,
  },
});
