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

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleDescription, setVehicleDescription] = useState('');
  const [sellerAffirmed, setSellerAffirmed] = useState(false);
  const [lineItems, setLineItems] = useState<LineItemInput[]>([]);
  const [signature, setSignature] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Price override state
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [overrideIndex, setOverrideIndex] = useState<number | null>(null);
  const [overridePrice, setOverridePrice] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Derived values
  const receiptTotal = calculateReceiptTotal(lineItems);

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
        isRestricted: metal.is_restricted,
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
              overrideApprovedBy: 'access_code',
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

  const hasRestrictedMetal = lineItems.some((item) => item.isRestricted);

  const resetForm = (keepCustomer = false) => {
    if (!keepCustomer) {
      setCustomerName('');
      setCustomerPhone('');
    }
    setVehiclePlate('');
    setVehicleDescription('');
    setSellerAffirmed(false);
    setLineItems([]);
    setSignature(null);
    setSaving(false);
    setShowCodeModal(false);
    setOverrideIndex(null);
    setOverridePrice('');
    setEditingIndex(null);
  };

  const saveReceipt = async (
    onSuccess: (receiptId: string, customerId: string) => void,
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
    if (hasRestrictedMetal) {
      if (!vehiclePlate.trim() || !vehicleDescription.trim()) {
        Alert.alert(t.error, t.vehicleRequired);
        return;
      }
      if (!sellerAffirmed) {
        Alert.alert(t.error, t.affirmationRequired);
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

    setSaving(true);
    try {
      const receipt = await createReceipt({
        customerName,
        customerPhone,
        customerId,
        type: 'buy',
        subtotal: receiptTotal,
        signatureUri: signatureData,
        workerId: profile.id,
        notes: '',
        vehiclePlate,
        vehicleDescription,
        sellerAffirmed,
        lineItems,
      });
      onSuccess(receipt.id, receipt.customer_id);
    } catch (err) {
      console.error('[saveReceipt] Error:', err);
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
    vehiclePlate,
    vehicleDescription,
    sellerAffirmed,
    hasRestrictedMetal,
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
    setVehiclePlate,
    setVehicleDescription,
    setSellerAffirmed,
    setOverridePrice,
    setSignature,

    // Actions
    addLineItem,
    removeLineItem,
    startPriceEdit,
    requestOverride,
    approveOverride,
    cancelOverride,
    cancelEdit,
    saveReceipt,
    resetForm,
  };
}
