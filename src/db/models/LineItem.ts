import { Model } from '@nozbe/watermelondb';
import {
  field,
  date,
  readonly,
  relation,
} from '@nozbe/watermelondb/decorators';
import type { Relation } from '@nozbe/watermelondb';
import type Receipt from './Receipt';
import type Metal from './Metal';

export default class LineItem extends Model {
  static table = 'line_items';

  static associations = {
    receipts: { type: 'belongs_to' as const, key: 'receipt_id' },
    metals: { type: 'belongs_to' as const, key: 'metal_id' },
  };

  @field('receipt_id') receiptId!: string;
  @field('metal_id') metalId!: string;
  @field('metal_name') metalName!: string;
  @field('weight') weight!: number; // net weight
  @field('gross_weight') grossWeight!: number | null;
  @field('tare_weight') tareWeight!: number | null;
  @field('price_per_lb') pricePerLb!: number;
  @field('original_price_per_lb') originalPricePerLb!: number;
  @field('is_price_override') isPriceOverride!: boolean;
  @field('override_approved_by') overrideApprovedBy!: string | null;
  @field('total') total!: number;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('receipts', 'receipt_id') receipt!: Relation<Receipt>;
  @relation('metals', 'metal_id') metal!: Relation<Metal>;
}
