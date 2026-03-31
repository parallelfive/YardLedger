export type UserRole = 'admin' | 'worker';

export type ReceiptType = 'buy' | 'sell';

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
}

export interface PendingUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}
