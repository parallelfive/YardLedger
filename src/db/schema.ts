import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 2,
  tables: [
    // Admin-managed metal catalog with pricing
    tableSchema({
      name: 'metals',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'price_per_lb', type: 'number' },
        { name: 'is_active', type: 'boolean' },
        { name: 'updated_by', type: 'string' }, // user ID of admin who last changed pricing
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Local cache of user profiles + roles
    tableSchema({
      name: 'users',
      columns: [
        { name: 'supabase_id', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'role', type: 'string' }, // 'admin' | 'worker'
        { name: 'is_active', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // A receipt groups line items for one customer visit
    tableSchema({
      name: 'receipts',
      columns: [
        { name: 'receipt_number', type: 'string' },
        { name: 'customer_name', type: 'string' },
        { name: 'customer_phone', type: 'string' },
        { name: 'type', type: 'string' }, // 'buy' | 'sell'
        { name: 'subtotal', type: 'number' },
        { name: 'signature_uri', type: 'string', isOptional: true },
        { name: 'worker_id', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Individual metal entries on a receipt
    tableSchema({
      name: 'line_items',
      columns: [
        { name: 'receipt_id', type: 'string' },
        { name: 'metal_id', type: 'string' },
        { name: 'metal_name', type: 'string' }, // denormalized for offline display
        { name: 'weight', type: 'number' }, // net weight (gross − tare, or keyed directly)
        { name: 'gross_weight', type: 'number', isOptional: true }, // scale reading incl. vehicle/container
        { name: 'tare_weight', type: 'number', isOptional: true }, // empty vehicle/container weight
        { name: 'price_per_lb', type: 'number' }, // snapshot at time of transaction
        { name: 'original_price_per_lb', type: 'number' }, // catalog price before any override
        { name: 'is_price_override', type: 'boolean' },
        { name: 'override_approved_by', type: 'string', isOptional: true }, // admin user ID who approved
        { name: 'total', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Running inventory totals per metal
    tableSchema({
      name: 'inventory',
      columns: [
        { name: 'metal_id', type: 'string' },
        { name: 'metal_name', type: 'string' }, // denormalized
        { name: 'weight', type: 'number' },
        { name: 'avg_cost_per_lb', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Outgoing sales with profit tracking
    tableSchema({
      name: 'sales',
      columns: [
        { name: 'metal_id', type: 'string' },
        { name: 'metal_name', type: 'string' }, // denormalized
        { name: 'weight', type: 'number' },
        { name: 'sale_price_per_lb', type: 'number' },
        { name: 'cost_basis_per_lb', type: 'number' },
        { name: 'total_revenue', type: 'number' },
        { name: 'profit', type: 'number' },
        { name: 'buyer_name', type: 'string', isOptional: true },
        { name: 'worker_id', type: 'string' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
