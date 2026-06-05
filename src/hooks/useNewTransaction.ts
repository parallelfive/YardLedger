import { useState, type RefObject } from 'react';
import { Alert } from 'react-native';
import type { LineItemInput, Metal } from '../types';
import type { SignaturePadHandle } from '../components/SignaturePad';
import { useAppSelector, type RootState } from '../store';
import { useT } from './useT';
import { createReceipt } from '../services/receipts';
import {
  calculateLineItemTotal,
  calculateReceiptTotal,
} from '../utils/calculations';

export function useNewTransaction(
  signaturePadRef?: RefObject<SignaturePadHandle | null>
) {
  const { t } = useT();
  const profile = useAppSelector((state: RootState) => state.auth.profile);
  // Attribute the buy to the staffer on shift (PIN'd in), not the device's
  // session user. Falls back to the session profile when no PIN is in use.
  const activeIdentity = useAppSelector(
    (state: RootState) => state.auth.activeIdentity
  );

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sellerAffirmed, setSellerAffirmed] = useState(false);
  // Payment method. NM prohibits cash for catalytic converters (57-30-2.4),
  // so a converter transaction is forced to check below.
  const [paymentMethod, setPaymentMethod] = useState<
    'cash' | 'check' | 'other'
  >('cash');

  // Seller ID (regulated materials — NM Purchase Record)
  const [sellerName, setSellerName] = useState('');
  const [sellerDlNumber, setSellerDlNumber] = useState('');
  const [sellerStateOfIssue, setSellerStateOfIssue] = useState('');
  const [sellerDob, setSellerDob] = useState('');
  const [sellerAddress, setSellerAddress] = useState('');
  const [sellerCity, setSellerCity] = useState('');
  const [sellerState, setSellerState] = useState('');
  const [sellerZip, setSellerZip] = useState('');
  const [sellerIdPhotoUri, setSellerIdPhotoUri] = useState<string | null>(null);
  // NM 57-30-5(C): date/time-stamped photo of the seller and the material.
  const [sellerPhotoUri, setSellerPhotoUri] = useState<string | null>(null);
  const [materialPhotoUri, setMaterialPhotoUri] = useState<string | null>(null);

  // Vehicle info (regulated materials)
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');

  // Catalytic converter (restricted — additional NM documentation)
  const [catConverterNumbers, setCatConverterNumbers] = useState('');
  const [transportVin, setTransportVin] = useState('');
  const [catConverterPhotoUri, setCatConverterPhotoUri] = useState<
    string | null
  >(null);
  const [catTitlePhotoUri, setCatTitlePhotoUri] = useState<string | null>(null);

  // Price override state
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  const [overridePrice, setOverridePrice] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Derived values
  const receiptTotal = calculateReceiptTotal(lineItems);
  const hasRegulatedMetal = lineItems.some((item) => item.isRegulated);
  const hasRestrictedMetal = lineItems.some((item) => item.isRestricted);
  // Driven by the authoritative metals.is_catalytic flag, not a name match.
  const hasCatalyticConverter = lineItems.some((item) => item.isCatalytic);

  const addLineItem = (
    metal: Metal,
    weight: number,
    weightData?: { net: number; gross?: number; tare?: number }
  ) => {
    setLineItems((prev) => [
      ...prev,
      {
        metalId: metal.id,
        metalName: metal.name,
        weight,
        grossWeight: weightData?.gross ?? null,
        tareWeight: weightData?.tare ?? null,
        pricePerLb: metal.price_per_lb,
        originalPricePerLb: metal.price_per_lb,
        isPriceOverride: false,
        overrideApprovedBy: null,
        total: calculateLineItemTotal(weight, metal.price_per_lb),
        isRegulated: metal.is_regulated,
        isRestricted: metal.is_restricted,
        isCatalytic: metal.is_catalytic,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const startPriceEdit = (index: number) => {
    setEditingIndex(index);
    setOverridePrice(lineItems[index].pricePerLb.toString());
  };

  const requestOverride = (index: number) => {
    const newPrice = parseFloat(overridePrice);
    if (!newPrice || newPrice <= 0) {
      Alert.alert(t.error, t.enterValidPrice);
      return;
    }
    if (newPrice === lineItems[index].originalPricePerLb) {
      setEditingIndex(null);
      return;
    }
    setOverrideIndex(index);
    setShowCodeModal(true);
  };

  // Begin an override with an explicit price (e.g. from the keypad add-sheet),
  // without round-tripping through the shared overridePrice string + an effect.
  // The AccessCodeModal it opens is modal, so the price can't be clobbered
  // before approveOverride reads it.
  const beginOverride = (index: number, price: number) => {
    if (!price || price <= 0) return;
    setOverridePrice(String(price));
    setOverrideIndex(index);
    setShowCodeModal(true);
  };

  const approveOverride = () => {
    if (overrideIndex === null) return;
    const newPrice = parseFloat(overridePrice);

    setLineItems((prev) =>
      prev.map((item, i) =>
        i === overrideIndex
          ? {
              ...item,
              pricePerLb: newPrice,
              isPriceOverride: true,
              overrideApprovedBy: null,
              total: calculateLineItemTotal(item.weight, newPrice),
            }
          : item
      )
    );

    setShowCodeModal(false);
    setOverrideIndex(null);
    setEditingIndex(null);
    setOverridePrice('');
  };

  const cancelOverride = () => {
    setShowCodeModal(false);
    setOverrideIndex(null);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setOverridePrice('');
  };

  const resetForm = (keepCustomer = false) => {
    if (!keepCustomer) {
      setCustomerName('');
      setCustomerPhone('');
    }
    setSellerAffirmed(false);
    setSellerName('');
    setSellerDlNumber('');
    setSellerStateOfIssue('');
    setSellerDob('');
    setSellerAddress('');
    setSellerCity('');
    setSellerState('');
    setSellerZip('');
    setSellerIdPhotoUri(null);
    setSellerPhotoUri(null);
    setMaterialPhotoUri(null);
    setCatConverterNumbers('');
    setTransportVin('');
    setCatConverterPhotoUri(null);
    setCatTitlePhotoUri(null);
    setVehiclePlate('');
    setVehicleYear('');
    setVehicleMake('');
    setVehicleModel('');
    setVehicleColor('');
    setLineItems([]);
    setSignature(null);
    setSaving(false);
    setShowCodeModal(false);
    setOverrideIndex(null);
    setOverridePrice('');
    setEditingIndex(null);
    signaturePadRef?.current?.clear();
  };

  const saveReceipt = async (
    onSuccess: (
      receiptId: string,
      customerId: string,
      sellerIdPhotoUrl: string | null
    ) => void,
    customerId?: string
  ) => {
    if (!customerName.trim()) {
      Alert.alert(t.error, t.enterCustomerName);
      return;
    }
    if (lineItems.length === 0) {
      Alert.alert(t.error, t.addAtLeastOneItem);
      return;
    }

    // Tier 2: Regulated material requires ID + vehicle
    if (hasRegulatedMetal) {
      if (!sellerName.trim() || !sellerDlNumber.trim()) {
        Alert.alert(t.error, t.sellerIdRequired);
        return;
      }
      if (!vehiclePlate.trim()) {
        Alert.alert(t.error, t.vehicleRequired);
        return;
      }
      if (!sellerAffirmed) {
        Alert.alert(t.error, t.affirmationRequired);
        return;
      }
    }

    // Tier 3+: Catalytic converter requires VIN + photos
    if (hasCatalyticConverter) {
      if (!transportVin.trim() || transportVin.trim().length !== 17) {
        Alert.alert(t.error, t.vinRequired);
        return;
      }
    }

    if (!profile) {
      Alert.alert(t.error, 'No user profile found');
      return;
    }

    // Read signature imperatively to avoid async race condition
    let signatureData = signature;
    if (signaturePadRef?.current) {
      signatureData = await signaturePadRef.current.readSignature();
    }
    if (!signatureData) {
      Alert.alert(t.error, t.signatureRequired);
      return;
    }

    // NM 57-30-2.4: catalytic converters must be paid by check, never cash.
    const effectivePaymentMethod = hasCatalyticConverter
      ? 'check'
      : paymentMethod;

    setSaving(true);
    try {
      const receipt = await createReceipt({
        customerName,
        customerPhone,
        customerId,
        type: 'buy',
        subtotal: receiptTotal,
        signatureUri: signatureData,
        workerId: activeIdentity?.user_id ?? profile.id,
        notes: '',
        vehiclePlate,
        vehicleYear,
        vehicleMake,
        vehicleModel,
        vehicleColor,
        sellerAffirmed,
        sellerName,
        sellerDlNumber,
        sellerStateOfIssue,
        sellerDob,
        sellerAddress,
        sellerCity,
        sellerState,
        sellerZip,
        sellerIdPhotoUri,
        catConverterNumbers,
        transportVin,
        catConverterPhotoUri,
        catTitlePhotoUri,
        sellerPhotoUri,
        materialPhotoUri,
        paymentMethod: effectivePaymentMethod,
        isCatalytic: hasCatalyticConverter,
        lineItems,
      });
      onSuccess(
        receipt.id,
        receipt.customer_id,
        receipt.seller_id_photo_uri ?? null
      );
    } catch (err) {
      // Log only the message — a raw Postgres/PostgREST error can echo back
      // submitted column values (seller DL #, address) into device logs.
      console.error('[saveReceipt] Error:', (err as Error).message);
      Alert.alert(t.error, (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return {
    // Data
    lineItems,
    customerName,
    customerPhone,
    sellerAffirmed,
    sellerName,
    sellerDlNumber,
    sellerStateOfIssue,
    sellerDob,
    sellerAddress,
    sellerCity,
    sellerState,
    sellerZip,
    sellerIdPhotoUri,
    vehiclePlate,
    vehicleYear,
    vehicleMake,
    vehicleModel,
    vehicleColor,
    catConverterNumbers,
    transportVin,
    catConverterPhotoUri,
    catTitlePhotoUri,
    sellerPhotoUri,
    materialPhotoUri,
    hasRegulatedMetal,
    hasRestrictedMetal,
    hasCatalyticConverter,
    paymentMethod,
    receiptTotal,
    signature,
    saving,

    // Override UI state
    showCodeModal,
    overridePrice,
    editingIndex,

    // Setters
    setCustomerName,
    setCustomerPhone,
    setSellerAffirmed,
    setPaymentMethod,
    setSellerName,
    setSellerDlNumber,
    setSellerStateOfIssue,
    setSellerDob,
    setSellerAddress,
    setSellerCity,
    setSellerState,
    setSellerZip,
    setSellerIdPhotoUri,
    setCatConverterNumbers,
    setTransportVin,
    setCatConverterPhotoUri,
    setCatTitlePhotoUri,
    setSellerPhotoUri,
    setMaterialPhotoUri,
    setVehiclePlate,
    setVehicleYear,
    setVehicleMake,
    setVehicleModel,
    setVehicleColor,
    setOverridePrice,
    setSignature,

    // Actions
    addLineItem,
    removeLineItem,
    startPriceEdit,
    requestOverride,
    beginOverride,
    approveOverride,
    cancelOverride,
    cancelEdit,
    saveReceipt,
    resetForm,
  };
}
