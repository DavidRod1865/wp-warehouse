# WP Warehouse — Project Site Map

> Warehouse management system for With Pride HVAC.
> React 19 + TypeScript + Vite + Tailwind/DaisyUI + Supabase + Sortly API

---

## Application Routes

### Public Routes (No Auth Required)
| Route | Page Component | Purpose |
|---|---|---|
| `/login` | `Login.tsx` | Manager/admin email + password login |
| `/driver/login` | `DriverLogin.tsx` | Driver username + password/PIN login |
| `/forgot-password` | `ForgotPassword.tsx` | Password reset request form |
| `/reset-password` | `ResetPassword.tsx` | Password reset confirmation (from email link) |

### Manager Routes (Role: warehouse_manager, apm, admin)
All nested inside `DashboardLayout` which provides sidebar nav + mobile bottom nav.

| Route | Page Component | Purpose |
|---|---|---|
| `/` | `Dashboard.tsx` | Main dashboard — delivery overview and stats |
| `/deliveries` | `Dashboard.tsx` | Same as root (delivery list view) |
| `/deliveries/create` | `DeliveryForm.tsx` | Create a new delivery order |
| `/deliveries/:id` | `DeliveryDetail.tsx` | View delivery details, status, items |
| `/deliveries/:id/edit` | `DeliveryForm.tsx` | Edit an existing delivery |
| `/inventory` | `WarehouseInventory.tsx` | Browse Sortly inventory (folders/items) |
| `/inventory/adjustments` | `InventoryAdjustments.tsx` | Record inventory adjustments (returns, damage, transfers) |
| `/batches/create` | `CreateBatch.tsx` | Group multiple deliveries into a batch |
| `/activity-log` | `ActivityLog.tsx` | Audit trail of all system actions |
| `/vendors` | `Vendors.tsx` | Manage vendor contacts and addresses |
| `/drivers` | `DriverManagement.tsx` | Create/edit/delete driver accounts |
| `/drivers/metrics` | `DriverMetrics.tsx` | Driver performance analytics and charts |
| `/settings` | `Settings.tsx` | User profile and app settings |

### Driver Routes (Role: driver)
Protected by `DriverRoute` — redirects non-drivers away.

| Route | Page Component | Purpose |
|---|---|---|
| `/driver/deliveries` | `DriverDeliveries.tsx` | List of deliveries assigned to this driver |
| `/driver/deliveries/:id` | `DriverDeliveryDetail.tsx` | Delivery details with confirm/signature flow |

---

## Source File Map

### Entry Points
```
src/
├── main.tsx                    # React DOM root — renders <App> in StrictMode
├── App.tsx                     # Router setup, auth provider, route definitions
├── index.css                   # Global Tailwind styles
└── vite-env.d.ts               # Vite type declarations
```

### Contexts (Global State)
```
src/contexts/
└── AuthContext.tsx              # Auth state, user profile, Supabase realtime subscriptions
                                 # Provides: user, profile, signIn, signOut, resetPassword
                                 # Sets up realtime channels for deliveries, items, notifications, inventory
```

### Libraries (Client Instances)
```
src/lib/
├── supabase.ts                 # Two Supabase clients:
│                                #   supabase — main client for auth sessions
│                                #   supabaseDriverAuth — isolated client for creating driver accounts
│                                #                        (persistSession: false to avoid hijacking admin session)
│
└── sortly.ts                   # Sortly API client — all calls route through sortly-proxy Edge Function
                                 # Methods: listItems, getItem, createItem, updateItem, deleteItem,
                                 #          copyItem (warehouse→truck), moveItem (truck→jobsite),
                                 #          searchItems, addDeliveryNote, removeDeliveryNote
```

### Hooks (Reusable Logic)
```
src/hooks/
├── useSessionTimeout.ts        # Auto sign-out after inactivity (role-based timeouts:
│                                #   driver=8h, admin=2h, warehouse_manager/apm=4h)
│
└── useDeliveryFormData.ts      # Loads all data needed for delivery creation/editing:
                                 # projects (from DB + auto-synced from Sortly), trucks, root folders, vendors
```

### Services (Business Logic Layer)
```
src/services/
├── sortlyApi.ts                # High-level Sortly operations with caching and deduplication
│                                # Exports: fetchAllFolders, fetchAllItems, fetchFolderItems,
│                                #          searchItems, moveItem, copyItem, createItem, createFolder,
│                                #          updateItem, deleteItem, invalidateCache
│
├── cache.ts                    # Generic TTL cache (2-minute default) for API responses
│                                # Singleton: cacheService — used by sortlyApi.ts
│
├── inventoryCache.ts           # Per-folder item cache with TTL — stores items being viewed
│                                # Singleton: inventoryCache — used by WarehouseInventory page
│
├── sortlyPreload.ts            # Warms Sortly caches immediately after login (non-blocking)
│                                # Called from AuthContext after profile fetch for non-driver roles
│
├── deliveryConfirm.ts          # Driver-side delivery operations:
│                                #   fetchDriverDeliveries (by folder or driver ID)
│                                #   fetchDeliveryItems, fetchDeliveryConfirmation
│                                #   uploadSignatureImage (to Supabase storage)
│
├── deliveryDelete.ts           # Soft-delete delivery with Sortly rollback
│                                # If "pending": moves items back from truck to source location,
│                                # removes delivery notes, then sets deleted_at timestamp
│
├── batchRouting.ts             # Delivery batch management:
│                                #   createBatch, fetchBatches, fetchBatchWithDeliveries
│                                #   orderDeliveriesByRoute (sorts by zip code)
│                                #   updateBatchStatus, reassignBatch, deleteBatch
│
├── inventoryAdjustment.ts      # Inventory adjustment operations (return, damage, transfer, manual)
│                                # Creates adjustment record + executes Sortly moves + logs activity
│
├── driverAnalytics.ts          # Driver performance metrics:
│                                #   fetchDriverPerformance (materialized view)
│                                #   fetchDriverDetailMetrics (computed from delivery data)
│                                #   fetchDeliveryActivity (chart data grouped by date)
│                                #   exportDriverMetricsToCSV
│
├── notifications.ts            # Delivery notifications via Edge Function
│                                #   sendDeliveryNotification, fetchUserNotifications
│                                #   updateNotificationPreferences
│
├── photoUpload.ts              # Delivery photo management:
│                                #   uploadDeliveryPhoto (to Supabase storage + DB record)
│                                #   fetchDeliveryPhotos, deleteDeliveryPhoto
│                                #   compressImage (client-side resize before upload)
│
└── receivingLog.ts             # Receiving log CRUD:
                                 #   createReceivingLog, updateReceivingLog, deleteReceivingLog
                                 #   fetchReceivingLogs (by month), fetchReceivingLogWithEntries
                                 #   createReceivingLogEntry, attachFileToEntry
```

### Pages (Route Components)
```
src/pages/
├── Dashboard.tsx               # Main delivery list with stats and filters
├── DeliveryForm.tsx            # Create/edit delivery — item selection from Sortly + addresses
├── DeliveryDetail.tsx          # View delivery with items, status, activity log
├── WarehouseInventory.tsx      # Sortly folder browser with search, create, edit, delete
├── InventoryAdjustments.tsx    # Record returns, damages, transfers, manual corrections
├── CreateBatch.tsx             # Group pending deliveries into a driver batch
├── PackingLists.tsx            # Generate packing lists from batches
├── ActivityLog.tsx             # Filterable audit trail of all system actions
├── Vendors.tsx                 # CRUD for vendor contacts and addresses
├── DriverManagement.tsx        # Admin CRUD for driver accounts (create, reset, delete)
├── DriverMetrics.tsx           # Charts and tables for driver performance
├── Settings.tsx                # User profile settings
├── DriverSettings.tsx          # Driver-specific settings (PIN management)
├── Login.tsx                   # Manager/admin login form
├── LoginSelector.tsx           # Landing/login selector (shown when unauthenticated)
├── DriverLogin.tsx             # Driver login form (username + password or PIN)
├── DriverDeliveries.tsx        # Driver's assigned delivery list
├── DriverDeliveryDetail.tsx    # Driver's delivery detail with confirm + signature
├── ForgotPassword.tsx          # Password reset request
├── ResetPassword.tsx           # Password reset confirmation
├── FolderFetcher.tsx           # Dev utility — fetch and display Sortly folder structure
└── LandingPage.tsx             # Public landing page
```

### Components
```
src/components/
├── DashboardLayout.tsx         # Shell layout — sidebar (desktop) + bottom nav (mobile)
├── SidebarNav.tsx              # Desktop sidebar navigation
├── Deliveries.tsx              # Delivery list component used in Dashboard
├── ItemSelector.tsx            # Sortly item picker for delivery forms
├── ItemFormModal.tsx           # Create/edit Sortly item modal
├── ManualItemModal.tsx         # Add manual (non-Sortly) item to delivery
├── BatchAssignment.tsx         # Assign deliveries to a batch
├── AdjustmentForm.tsx          # Form for recording inventory adjustments
├── ActivityTimeline.tsx        # Visual timeline of delivery/activity events
├── PhotoCapture.tsx            # Camera component for delivery proof photos
├── AddressEditor.tsx           # Editable address form component
├── ReceivingLogModal.tsx       # Modal for logging received inventory
├── ChangePasswordForm.tsx      # Password change form
├── PasswordInput.tsx           # Password field with toggle visibility
├── PasswordStrengthIndicator.tsx # Visual password strength meter
├── DeleteConfirmDialog.tsx     # Reusable confirmation dialog
├── DriverStatsCard.tsx         # Summary card for driver performance
├── SettingsModal.tsx           # Settings modal overlay
├── PWABadge.tsx                # PWA install/update badge
│
├── ui/                         # Reusable UI primitives (design system)
│   ├── index.ts                # Barrel export
│   ├── Button.tsx              # Button component with variants
│   ├── Card.tsx                # Card container component
│   ├── Badge.tsx               # Status badge component
│   ├── Modal.tsx               # Modal dialog component
│   ├── Input.tsx               # Form input component
│   └── Toast.tsx               # Toast notification provider + component
│
├── landing/                    # Landing page sections
│   ├── Hero.tsx                # Hero section with CTA
│   ├── Features.tsx            # Feature highlights grid
│   ├── PortalSelector.tsx      # Manager vs Driver portal cards
│   ├── Workflow.tsx            # How-it-works workflow steps
│   ├── Stats.tsx               # Key metrics display
│   └── Footer.tsx              # Landing page footer
│
├── magicui/                    # Visual effect components
│   ├── cn.ts                   # Class name utility (clsx + twMerge)
│   ├── dot-pattern.tsx         # Dot grid background pattern
│   ├── number-ticker.tsx       # Animated number counter
│   └── retro-grid.tsx          # Retro grid background effect
│
└── deliveries/                 # Delivery-specific components
    ├── CreateDeliveryModal.tsx  # Quick-create delivery modal
    ├── EditDeliveryModal.tsx    # Quick-edit delivery modal
    ├── types.ts                # Delivery component type definitions
    ├── useDeliveries.ts        # Hook for delivery list data fetching
    └── deliveryPdf.ts          # PDF generation for delivery documents
```

### Types (TypeScript Interfaces)
```
src/types/
├── sortly.ts                   # Sortly API types (SortlyItem, SortlyApiResponse, etc.)
├── delivery.ts                 # Delivery, Project, Truck, DeliveryItem types
├── address.ts                  # Address interface
├── activity.ts                 # Activity log types
├── photo.ts                    # Photo types
├── receivingLog.ts             # Receiving log and entry types
├── react-signature-canvas.d.ts # Type declarations for react-signature-canvas
└── react-date-range.d.ts       # Type declarations for react-date-range
```

### Utilities (Pure Helper Functions)
```
src/utils/
├── deliveryNumber.ts           # Generate delivery IDs: DEL-YYYYMMDD-XXX
├── batchNumber.ts              # Generate batch IDs: BAT-YYYYMMDD-XXX
├── adjustmentNumber.ts         # Generate adjustment IDs: ADJ-YYYYMMDD-XXX
├── generateSequentialNumber.ts # Shared sequential number generator
├── generateDeliveryPDF.ts      # jsPDF-based delivery order PDF generation
├── fetchSortlyFolders.ts       # Utility to fetch Sortly folder tree
├── sortlyHelpers.ts            # Sortly data transformation helpers
└── validation.ts               # Input validation functions
```

### Assets
```
src/assets/
├── WP-warehouse-logo.png       # App logo
├── Expansive Warehouse Interior.png  # Background image
├── react.svg                   # Default Vite React logo
└── lottie/                     # Lottie animation JSON files
    ├── warehouse.json
    ├── delivery-truck.json
    ├── driver.json
    ├── inventory.json
    ├── report.json
    └── checkmark.json
```

---

## Supabase Edge Functions

```
supabase/functions/
├── sortly-proxy/               # ★ Central Sortly API gateway — all inventory API calls route here
│                                # Verifies JWT, forwards requests to Sortly with secret key
│
├── sortly-webhook/             # Receives webhooks from Sortly for real-time inventory sync
│
├── send-delivery-notification/ # Sends email/push notifications for delivery events
│
├── set-driver-pin/             # Sets or updates a driver's 4-digit PIN
├── verify-driver-pin/          # Validates driver PIN on login
│
├── delete-driver/              # Admin operation — deletes a driver account
├── link-driver-profile/        # Links a new driver auth account to a user profile
├── reset-driver-password/      # Resets a driver's password
└── update-driver-username/     # Updates a driver's username
```

---

## Data Flow Diagrams

### Delivery Lifecycle
```
1. Manager creates delivery (DeliveryForm)
      ↓
2. Items copied: Warehouse folder → Truck folder (Sortly copyItem)
      ↓
3. Delivery notes added to Sortly items: [Delivery: DEL-YYYYMMDD-XXX]
      ↓
4. Driver sees delivery in portal (DriverDeliveries)
      ↓
5. Driver starts delivery → status: "in_transit"
      ↓
6. Driver confirms with signature (DriverDeliveryDetail)
      ↓
7. Items moved: Truck folder → Job Site folder (Sortly moveItem)
      ↓
8. Status: "delivered" or "partial" — activity logged
```

### Sortly API Call Flow
```
Frontend → supabase.functions.invoke("sortly-proxy")
              ↓
         Edge Function verifies JWT
              ↓
         Forwards to Sortly REST API with SORTLY_SECRET_KEY
              ↓
         Returns response to frontend
              ↓
         Frontend caches response (2-min TTL)
```

### Authentication Flow
```
Manager: Email + Password → Supabase Auth → Profile fetch → Dashboard
Driver:  Username + Password/PIN → Supabase Auth (or PIN Edge Function) → Profile fetch → Driver Portal
```

---

## Key Architectural Patterns

| Pattern | Where | Why |
|---|---|---|
| **Dual Supabase clients** | `lib/supabase.ts` | Prevents admin session hijack when creating driver accounts |
| **Edge Function proxy** | `sortly-proxy/` | Keeps Sortly API key server-side (security) |
| **2-layer caching** | `cache.ts` + `inventoryCache.ts` | Reduces Sortly API calls (rate-limited) |
| **Request deduplication** | `sortlyApi.ts` (inFlight map) | Prevents duplicate concurrent API calls |
| **Cache preloading** | `sortlyPreload.ts` | Warms caches on login for instant page loads |
| **Soft deletes** | `deliveries.deleted_at` | Preserves audit trail, enables recovery |
| **Realtime subscriptions** | `AuthContext.tsx` | Live updates via Supabase Postgres changes |
| **Role-based routing** | `App.tsx` guards | Separate UX for managers vs drivers |
| **Activity logging** | Throughout services | Full audit trail of all operations |
