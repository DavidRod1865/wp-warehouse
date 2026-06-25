# Database Migrations

## How to Apply Migrations

To apply these migrations to your Supabase database, you can use either:

### Option 1: Supabase Dashboard (Recommended for Production)
1. Log in to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of the migration file
4. Paste and execute the SQL

### Option 2: Supabase CLI
```bash
# If you have the Supabase CLI installed
supabase db push
```

### Option 3: Direct SQL Execution
Execute the SQL file directly against your database using `psql` or another PostgreSQL client.

## Available Migrations

### 20260210_add_started_at_to_deliveries.sql
**Purpose**: Adds support for the "in_transit" delivery status

**Changes**:
- Adds `started_at` column (timestamptz, nullable) to the `deliveries` table
- This column stores the timestamp when a driver starts a delivery (changes status from `pending` to `in_transit`)

**Impact**:
- No breaking changes
- Existing deliveries will have `started_at` as NULL
- Only new deliveries that use the "Start Delivery" feature will have this timestamp populated

**Application Changes**:
- `/src/pages/DriverDeliveryDetail.tsx` - Adds "Start Delivery" button for pending deliveries
- `/src/pages/Dashboard.tsx` - Adds "In Transit" filter tab and status badge
- `/src/pages/DriverDeliveries.tsx` - Updates status badge to show "In Transit"
- `/src/services/deliveryConfirm.ts` - Adds `started_at` field to interfaces and queries

**Activity Log**: When a delivery is started, an activity log entry is created with:
- `action: "in_transit"`
- `details.message: "Driver started delivery"`
