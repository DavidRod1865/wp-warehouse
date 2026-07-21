# WP Warehouse — Project Site Map

> Warehouse & delivery management system for With Pride HVAC.
> React 19 + TypeScript + Vite + Tailwind 4 + DaisyUI + TanStack Query — Supabase backend
> (Postgres, Auth, Storage, Edge Functions). Inventory is first-party (Sortly removed 2026-07).

---

## Application Routes

Defined in `src/app/routes.tsx`.

### Public Routes

| Route | Page Component | Purpose |
|---|---|---|
| `/login` | `features/auth/components/LoginPage.tsx` | Manager/admin email + password login |
| `/driver/login` | `features/auth/components/DriverLoginPage.tsx` | Driver username + password/PIN login |

### Manager Routes (Role: warehouse_manager, apm, admin)

Wrapped in `ManagerRoute` (auth guard) → `ManagerLayout` (`src/components/layout/ManagerLayout.tsx`).

| Route | Page Component | Purpose |
|---|---|---|
| `/` | `deliveries/components/DashboardPage.tsx` | Delivery overview, stats, quick actions |
| `/deliveries` | `deliveries/components/DeliveriesPage.tsx` | Full delivery list with filters |
| `/deliveries/new` | `deliveries/components/CreateDeliveryPage.tsx` | Create a delivery |
| `/deliveries/:id` | `deliveries/components/EditDeliveryPage.tsx` | Edit/view a delivery |
| `/inventory` | `inventory/components/InventoryPage.tsx` | Item + stock-level browser |
| `/locations` | `inventory/components/LocationsPage.tsx` | Manage warehouse areas, trucks, job sites |
| `/clients` | `clients/components/ClientsPage.tsx` | General contractor directory |
| `/clients/:id` | `clients/components/ClientDetailPage.tsx` | Client detail + associated projects |
| `/vendors` | `vendors/components/VendorsPage.tsx` | Vendor directory |
| `/vendors/:id` | `vendors/components/VendorDetailPage.tsx` | Vendor detail |
| `/projects` | `projects/components/ProjectsPage.tsx` | Project (job) directory |
| `/purchase-orders` | `purchase-orders/components/PurchaseOrdersPage.tsx` | PO list |
| `/purchase-orders/:id` | `purchase-orders/components/PoDetailPage.tsx` | PO detail + line-item review |
| `/receiving` | `receiving/components/ReceivingPage.tsx` | Daily receiving log, packing-list intake |
| `/audit` | `audit/components/AuditPage.tsx` | Reconciliation, cycle counts, signed deliveries |
| `/batches` | `components/shared/ComingSoon.tsx` | Placeholder — batching feature not yet built |
| `/packing-lists` | `components/shared/ComingSoon.tsx` | Placeholder |
| `/analytics` | `components/shared/ComingSoon.tsx` | Placeholder |
| `/users` | `components/shared/ComingSoon.tsx` | Placeholder |
| `/activity` | `components/shared/ComingSoon.tsx` | Placeholder |

> Note: `src/features/{activity,analytics,batching,drivers,packing-lists,users}/` exist as
> empty scaffold directories (components/hooks subfolders, no files) for these placeholder routes.

### Driver Routes (Role: driver)

Wrapped in `DriverRoute` (auth guard) → `DriverLayout` (`src/components/layout/DriverLayout.tsx`).

| Route | Page Component | Purpose |
|---|---|---|
| `/driver/deliveries` | `driver/components/DriverDeliveriesPage.tsx` | Deliveries assigned to this driver |
| `/driver/deliveries/:id` | `driver/components/DriverDeliveryDetailPage.tsx` | Delivery detail, confirm + signature |
| `/driver/settings` | `driver/components/DriverSettingsPage.tsx` | PIN/password settings |

Catch-all: unmatched paths redirect to `/`.

---

## Layout Shell

```
src/components/layout/
├── ManagerLayout.tsx   # Sidebar + sticky Topbar + <Outlet/> for manager routes
├── Sidebar.tsx          # 248px nav: Operations / Directory / Field / Data sections, user footer
├── Topbar.tsx           # Breadcrumbs (from URL segments), theme toggle
└── DriverLayout.tsx     # Simplified top bar for the mobile-first driver PWA
```

---

## Source File Map

### Entry Points
```
src/
├── main.tsx             # React DOM root
├── app/
│   ├── App.tsx           # Providers (QueryClient, Auth, Toast) + <RouterProvider>
│   └── routes.tsx        # All route definitions (see above)
├── index.css             # Tailwind + design tokens
└── vite-env.d.ts
```

### Library Clients
```
src/lib/
├── supabase.ts       # Single Supabase client (see CLAUDE.md — no dual-client pattern anymore)
└── queryClient.ts    # TanStack Query client instance
```

### Feature Folders (`src/features/*`)

Each feature generally follows `components/`, `hooks/`, `schemas/` (zod), `utils/`.

```
auth/            LoginPage, DriverLoginPage, ManagerRoute/DriverRoute guards,
                 useAuth (profile + session + realtime), useRequireRole, loginSchema

deliveries/      DashboardPage, DeliveriesPage, CreateDeliveryPage, EditDeliveryPage,
                 DeliveryForm + card subcomponents, ItemSelectorModal
                 hooks: useDeliveries, useDelivery, useDeliveryMutations (create/update/
                 cancel/confirm RPCs), useDeliveryFormData
                 utils: generateDeliveryPDF.ts

driver/          DriverDeliveriesPage, DriverDeliveryDetailPage, DriverSettingsPage,
                 SignatureModal, StatusBadge; useDriverDeliveries

inventory/       InventoryPage (items/stock browser), LocationsPage
                 hooks: useInventoryItems, useInventoryMutations, useItemMovements,
                 useLocations, useStockLevels

receiving/       ReceivingPage, DailyReceivingLog, NewReceiptModal, ReceiptReview,
                 ReceiptLineItems/Row, ItemMatchModal, PdfDropZone, CreatePoFromPackingList
                 hooks: useReceipts, useReceivingMutations (confirm_receipt RPC),
                 useDailyReceivingLog, useParsePdf, useFolderItems, useProjectItems
                 utils: generateReceivingLogPDF.ts, actionStyles.ts

purchase-orders/ PurchaseOrdersPage, PoDetailPage, UploadPoModal, PoUploadZone, EditPoModal
                 hooks: usePurchaseOrders, usePoMutations, useParsePo (calls
                 parse-purchase-order Edge Function)

projects/        ProjectsPage, ProjectFormModal, ProjectSelector
                 hooks: useProjects, useProjectMutations (syncs job_site location
                 from project address)

clients/         ClientsPage, ClientDetailPage, ClientFormModal (general_contractors)
                 hooks: useClients, useClientMutations

vendors/         VendorsPage, VendorDetailPage, VendorFormModal
                 hooks: useVendors, useVendorMutations

audit/           AuditPage with tabs: ReconciliationTab, CycleCountsTab, SignedDeliveriesTab
                 hooks: useReconciliation, useCycleCounts, useCycleCountMutations
                 (finalize_cycle_count RPC), useSignedDeliveries

activity/        (empty scaffold — backs /activity placeholder route)
analytics/       (empty scaffold — backs /analytics placeholder route)
batching/        (empty scaffold — backs /batches placeholder route)
drivers/         (empty scaffold — no manager-facing driver-admin UI built yet)
packing-lists/   (empty scaffold — backs /packing-lists placeholder route)
users/           (empty scaffold — backs /users placeholder route)
```

### Shared Components
```
src/components/
├── layout/    # ManagerLayout, Sidebar, Topbar, DriverLayout (see above)
├── shared/    # ComingSoon.tsx and other cross-feature components
└── ui/        # Design-system primitives (Icon, etc.)
```

### Types & Schemas
Per-feature `types.ts` / `schemas/*Schema.ts` (zod) live inside each feature folder
(e.g. `deliveries/schemas/deliverySchema.ts`, `receiving/schemas/receivingSchema.ts`).
Cross-feature shared types live in `src/types/` (e.g. `src/types/project.ts`).

---

## Supabase Edge Functions

```
supabase/functions/
├── parse-purchase-order/       # PDF upload → Claude-based parsing → PO line-item draft for review
├── parse-packing-list/         # Packing-list PDF → Claude-based parsing for receiving intake
├── send-delivery-notification/ # Delivery event notifications
├── set-driver-pin/             # Sets/updates a driver's PIN (service role)
├── verify-driver-pin/          # Validates PIN on driver login (bcrypt + lockout)
├── reset-driver-password/      # Resets a driver's password
├── update-driver-username/     # Updates a driver's username
├── link-driver-profile/        # Links a new driver auth account to a users row
└── delete-driver/              # Deletes a driver account
```

All privileged driver-account operations route through these Edge Functions using the
service role — never directly from the client.

---

## Database & Migrations Highlights

Migrations in `supabase/migrations/` are tracked in git (`!supabase/migrations/*.sql`
gitignore exception). Key milestones, in order:

| Migration | What it did |
|---|---|
| `20260212000000` – `20260212000004` | Early delivery/driver-performance/batch scaffolding |
| `20260325_driver_management_improvements` | Driver account hardening |
| `20260402000000` / `20260409000000` | Receiving logs + improvements |
| `20260413000000_create_app_config` | App-wide config table |
| `20260427000000_receiving_items_and_status` | Per-line receiving items + status |
| `20260428000000_drop_unused_tables` | Dropped legacy adjustment/batch tables with zero code references |
| `20260710000000_create_inventory_core` | First-party `locations`, `items`, `stock_levels`, `inventory_movements` — replaces Sortly |
| `20260710010000_harden_core_rls` | RLS hardening across core + deliveries + activity_log |
| `20260710020000_clients_vendors_projects` | `general_contractors`, `vendors`, `projects` tables |
| `20260713000000_purchase_orders` | `purchase_orders` + `po_line_items` + private PDF storage bucket |
| `20260713010000_receiving_po_rework` | Receiving ↔ PO linkage; `confirm_receipt` RPC |
| `20260713020000_po_lump_sum` | Lump-sum PO line-item support |
| `20260713030000_deliveries_cutover` | Deliveries off Sortly onto first-party inventory; `generate_delivery_number()`, `create_delivery`/`update_delivery_items`/`cancel_delivery`/`confirm_delivery` RPCs |
| `20260713040000_audit_suite` | `po_project_reconciliation` view, cycle counts, `finalize_cycle_count` RPC |
| `20260714202302_packing_list_storage` | Private `packing-lists` storage bucket + archival column |

All stock-affecting writes go through SECURITY DEFINER RPCs; clients only ever SELECT
`stock_levels` / `inventory_movements` directly.

---

## Data Flow Notes

### Purchase Order Intake
```
Manager uploads PO PDF (UploadPoModal)
   ↓
Edge Function parse-purchase-order (Claude parses vendor/line items)
   ↓
Draft PO + line items shown for human review (EditPoModal)
   ↓
Manager confirms → purchase_orders row (status: draft → confirmed)
```

### Receiving
```
Manager logs a receipt against a PO (NewReceiptModal / ItemMatchModal)
   ↓
confirm_receipt RPC (SECURITY DEFINER):
   - inserts inventory_movements ledger rows
   - updates stock_levels for the destination location
   - updates po_line_items received quantity + status
     (pending → partial → received; over_received allowed & flagged, never blocked)
```

### Delivery Lifecycle
```
Manager creates delivery (CreateDeliveryPage / DeliveryForm)
   ↓
create_delivery RPC:
   - generates delivery_number via generate_delivery_number()
     (format WP-MMDDYY-XX, daily reset, America/New_York)
   - moves stock from source location → truck location (inventory_movements + stock_levels)
   ↓
Driver sees delivery in Driver Portal (DriverDeliveriesPage)
   ↓
Driver confirms delivery + captures signature (SignatureModal)
   ↓
Signature image uploaded to private delivery-signatures-v2 bucket (storage path saved,
   viewed via createSignedUrl — never a public URL)
   ↓
confirm_delivery RPC moves stock truck → job-site location, updates delivery status
```

### Job Sites
```
Job-site locations are never entered directly by users — a project's address IS its
job site. useProjectMutations creates/syncs a job_site location whenever a project's
address changes.
```

### Authentication
```
Manager: email + password → Supabase Auth → profile fetch (useAuth) → ManagerLayout
Driver:  username + PIN → verify-driver-pin Edge Function (bcrypt + lockout) → DriverLayout
```

---

## Key Architectural Patterns

| Pattern | Where | Why |
|---|---|---|
| SECURITY DEFINER RPCs for all stock writes | `move_inventory`, `adjust_inventory`, `confirm_receipt`, `create_delivery`, `update_delivery_items`, `cancel_delivery`, `confirm_delivery`, `finalize_cycle_count` | Keeps the `inventory_movements` ledger append-only and consistent; clients cannot write `stock_levels`/`inventory_movements` directly |
| Per-feature query key factories | `*Keys.ts` in each feature's `hooks/` | Predictable TanStack Query cache invalidation after mutations |
| Job site = project address | `projects/hooks/useProjectMutations.ts` | Single source of truth for job-site addresses |
| Single Supabase client | `lib/supabase.ts` | Privileged ops isolated to Edge Functions (service role) instead of a second client |
| Private storage + signed URLs | `delivery-signatures-v2`, `purchase-orders`, `packing-lists` buckets | Signatures and vendor/financial documents are never public |
| Role-based routing | `ManagerRoute` / `DriverRoute` guards in `routes.tsx` | Separate UX for managers vs. drivers |
| RLS everywhere | Postgres policies + `is_manager()` helper | Managers write, authenticated read, drivers see/update only their own deliveries |
