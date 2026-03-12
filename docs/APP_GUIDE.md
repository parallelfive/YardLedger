# YardLedger — App Guide

## Overview

YardLedger is a scrap metal yard management app built with Expo (React Native). It handles buying metal from walk-in customers, tracking inventory, recording sales to larger recyclers, and generating business reports.

**Distribution**: Sideloaded / Expo Go only (no App Store).

---

## User Roles

| Role       | Capabilities                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **Admin**  | Manage metals & pricing, approve users, view all receipts/sales, access reports, generate access codes |
| **Worker** | Create buy receipts, record sales, view own transactions, request price overrides (with access code)   |

New accounts require admin approval before access is granted.

---

## Core Workflows

### 1. Buying Metal (Transactions Tab)

1. Tap **+ New Buy** to start a receipt.
2. Enter customer name and optional phone number.
3. Add line items: select a category, then a metal, then enter weight.
   - Price auto-fills from the metals table.
   - Tap a price to override it (requires a reusable access code from admin).
4. Collect customer signature.
5. Save the receipt. Inventory is automatically updated via a Postgres trigger (weighted average cost).

Receipt numbers are auto-generated: `YL-YYYYMMDD-NNNN`.

### 2. Inventory (Inventory Tab)

- Read-only view of current stock per metal.
- Shows weight on hand and average cost per lb.
- Automatically updated when buy receipts are saved or sales are recorded.

### 3. Selling Metal (Sales Tab)

Sales represent outgoing loads to larger recyclers. To record a sale:

1. Tap **+ New Sale**.
2. Optionally enter the buyer (recycler) name.
3. Pick a metal from inventory (only metals with stock > 0 appear).
4. Enter the weight sold (validated against available stock) and the sale price per lb (from the recycler's receipt).
5. A live revenue/profit preview appears as you enter values.
6. Save. Inventory is auto-deducted via a Postgres trigger.

The Sales tab also shows:

- **Total Profit** across all sales.
- **Profit by Category** breakdown (revenue, cost, profit per category).

### 4. Reports (Reports Tab — Admin Only)

Four reports are available:

#### Daily Summary

- Total bought (weight + dollars), total sold (weight + revenue), gross profit, receipt count.
- Top 5 metals bought by weight.
- Filterable by Today / This Week / This Month.

#### Inventory Valuation

- Per-metal comparison of cost value vs current market value.
- Summary cards: total cost value, total market value, unrealized gain/loss.
- Color-coded: green for gains, red for losses.

#### Profitability

- Per-metal breakdown of weight bought, buy cost, weight sold, revenue, profit, and margin %.
- Overall summary: total revenue, COGS (cost of goods sold), profit, and margin.
- Filterable by Today / This Week / This Month.

#### Shrinkage

- Compares expected inventory (total bought - total sold) against actual inventory.
- Discrepancy shown in lbs and percentage.
- Color-coded severity: green (< 2%), yellow (2-5%), red (> 5%).
- Helps identify theft, processing losses, or data entry errors.

### 5. Admin (Admin Tab — Admin Only)

- **Users**: Approve pending accounts, promote to admin, deactivate users.
- **Pricing**: Edit base metal prices directly (no access code needed — admin is already authenticated).

### 6. Price Overrides (Access Codes)

Admins generate reusable 6-digit access codes. Workers enter these codes when overriding a line item price during a buy transaction. The override is tracked on the line item (`is_price_override`, `override_approved_by`).

### 7. Price Sheet

Workers can view current metal prices from the Transactions screen via the **Prices** button (bottom-left). This opens a read-only modal grouped by category.

---

## Database Schema

| Table              | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `metals`           | Metal types with price_per_lb, category, active status       |
| `metal_categories` | Categories (Ferrous, Non-Ferrous, etc.)                      |
| `users`            | Role-based accounts (admin/worker)                           |
| `receipts`         | Buy transaction headers (customer, subtotal, signature)      |
| `line_items`       | Receipt line items (metal, weight, price, override tracking) |
| `inventory`        | Current stock per metal (auto-updated by triggers)           |
| `sales`            | Outgoing sales with profit tracking                          |
| `access_codes`     | Reusable codes for price overrides                           |

### Key Triggers

- **Buy receipt saved** → inventory `weight` increases, `avg_cost_per_lb` recalculated (weighted average).
- **Sale recorded** → inventory `weight` decreases.
- **Inventory constraint** → `weight >= 0` enforced at the database level (cannot sell more than available).

---

## Tech Stack

- **Frontend**: Expo (React Native) + TypeScript
- **Backend**: Supabase (Postgres, Auth, RLS, Edge Functions)
- **Local DB**: WatermelonDB (offline-first SQLite with sync)
- **State**: Redux Toolkit
- **Navigation**: React Navigation v7 (native-stack + bottom-tabs)
- **i18n**: English and Spanish

---

## Project Structure

```
src/
  components/     Shared UI (Button, Card, Input, Modals, etc.)
  config/         Supabase client setup
  constants/      Theme (colors, spacing, fontSize, borderRadius)
  db/             WatermelonDB schema, models, sync
  hooks/          Data fetching hooks (useMetals, useReceipts, etc.)
  i18n/           Translation files (en.ts, es.ts)
  navigation/     React Navigation navigators
  screens/        Screen components grouped by feature
  services/       Supabase data access layer
  store/          Redux Toolkit slices (auth, app)
  types/          Shared TypeScript types
  utils/          Pure utility functions
```

### Architecture Rule

```
DB migration → Service → Store/Hook → Screen
```

Never call Supabase directly from screens. Services wrap all queries.
