import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import Metal from './models/Metal';
import User from './models/User';
import Receipt from './models/Receipt';
import LineItem from './models/LineItem';
import Inventory from './models/Inventory';
import Sale from './models/Sale';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: true,
  onSetUpError: (error) => {
    console.error('WatermelonDB setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [Metal, User, Receipt, LineItem, Inventory, Sale],
});
