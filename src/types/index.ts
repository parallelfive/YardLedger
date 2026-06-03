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
  category_id: string | null;
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
