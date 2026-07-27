export type UserRole = 'owner' | 'admin' | 'worker';

export type ReceiptType = 'buy' | 'sell';

export interface Company {
  id: string;
  name: string;
  prefix: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
}

// How a material is priced: 'lb' = weight × price/lb (the default), 'each' =
// quantity × price/piece (converters, rims, batteries…). For an 'each' line,
// `pricePerLb` carries the per-piece price and `weight` is 0.
export type PricingUnit = 'lb' | 'each';

export interface LineItemInput {
  metalId: string;
  metalName: string;
  weight: number;
  grossWeight?: number | null;
  tareWeight?: number | null;
  pricePerLb: number;
  originalPricePerLb: number;
  isPriceOverride: boolean;
  overrideApprovedBy: string | null;
  total: number;
  isRegulated: boolean;
  isRestricted: boolean;
  isCatalytic: boolean;
  // Per-piece pricing. unit defaults to 'lb'; when 'each', quantity is the
  // number of pieces and pricing runs off quantity × pricePerLb.
  unit?: PricingUnit;
  quantity?: number | null;
}

export interface MetalCategory {
  id: string;
  name: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Metal {
  id: string;
  name: string;
  price_per_lb: number;
  is_active: boolean;
  is_regulated: boolean;
  is_restricted: boolean;
  is_catalytic: boolean;
  category_id: string | null;
  // 'lb' (price_per_lb is $/lb) or 'each' (price_per_lb is $/piece). Defaults to
  // 'lb' for every existing metal.
  pricing_unit?: PricingUnit;
}

export interface UserProfile {
  id: string;
  supabaseId: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  companyId: string;
}

export interface ParsedIdFields {
  name: string | null;
  address: string | null;
  dob: string | null;
  driversLicense: string | null;
  // Richer fields the AAMVA barcode parser can supply (OCR leaves them
  // undefined). Optional so the camera-OCR path is unaffected.
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  stateOfIssue?: string | null;
}

export interface SellerIdInfo {
  sellerName: string;
  sellerDlNumber: string;
  sellerStateOfIssue: string;
  sellerDob: string;
  sellerAddress: string;
  sellerCity: string;
  sellerState: string;
  sellerZip: string;
  sellerIdPhotoUri: string | null;
}

export interface VehicleInfo {
  vehiclePlate: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
}

export interface PendingUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}
