import {
  schemaMigrations,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

// WatermelonDB local-schema migrations. Kept in lockstep with schema.ts —
// bump the schema `version` there and add the matching step here so an
// existing local DB upgrades in place instead of being wiped.
export const migrations = schemaMigrations({
  migrations: [
    // v1 → v2: tare weighing. Gross/tare mirror the Postgres line_items
    // columns; net stays in `weight`.
    {
      toVersion: 2,
      steps: [
        addColumns({
          table: 'line_items',
          columns: [
            { name: 'gross_weight', type: 'number', isOptional: true },
            { name: 'tare_weight', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
