# Improvements Backlog

Living list of ideas, follow-ups, and known rough edges. Add as we go; move items
to "Done" with a date when shipped. (Started 2026-07-21 during the app audit.)

## Bugs / must-fix
- [ ] **Driver assignment** — deliveries have no driver field anywhere in the manager UI,
  so they never appear in the driver portal (`useDriverDeliveries` filters on `driver_id`).
  Add a driver select (users with role `driver`) to the delivery form; `create_delivery`
  RPC already accepts `driver_id`. *(Deferred by David 2026-07-21.)*
- [ ] Receipt confirm banner says "PO will be fully received" when only the lines in the
  current receipt are complete — should compute across all PO lines (NewReceiptModal confirm step).
- [ ] Over-available delivery quantity blocks submit silently — add a toast/inline error
  next to the Create order button.
- [ ] Receipt confirm shows action "Updated" while inventory impact says "1 created" for
  brand-new items — align the labels.

## Features / streamlining
- [ ] **Procore project sync** — poll `GET https://api.procore.com/rest/v1.0/projects`
  (OAuth2 client-credentials; token from `https://login.procore.com/oauth`) from a new
  edge function; "Sync from Procore" button with human review (match by name before
  insert). Needs a Procore developer app + company id; store credentials as function
  secrets. Design ready; awaiting Procore app setup.
- [ ] **AI item matching in receiving** — replace `scorePOLine` string matching
  (ItemMatchModal) with a Claude Haiku call resolving vendor line descriptions to
  canonical inventory items, using the same edge-function pattern as
  `parse-purchase-order` / `parse-packing-list`.
- [ ] AI project digest — auto-summary of a project's reconciliation state / anomalies
  on the project hub (same Haiku pattern).
- [ ] Reconciliation view: scope `qty_on_hand_warehouse` / `qty_on_truck` per project via
  `locations.project_id` now that per-project staging locations exist (view currently
  reports item-wide totals).
- [ ] Users admin page (`/users` is ComingSoon) — edge functions `delete-driver`,
  `reset-driver-password`, `link-driver-profile`, `update-driver-username` are deployed
  but have no UI calling them.
- [ ] Activity, Analytics/Reports, Batches, Packing-list archive pages (ComingSoon stubs).
- [ ] Offline queueing for the driver PWA (explicitly deferred during rebuild).

## Tech debt / hygiene
- [ ] Deprecate `projects.job_site_location_id` once all reads use
  `locations.project_id` (kept for back-compat by `ensure_project_locations`).
- [ ] Drop orphaned `sortly_webhook_logs` table (confirm no Sortly webhook still points
  at it) and remaining vestigial Sortly fields (`sortly_*` columns on projects,
  `sortly_item_id` in ItemSelectorModal insert).
- [ ] Harden driver auth: `internal_auth_token` is stored plaintext in `users` and used
  server-side as the Supabase Auth password in `verify-driver-pin` (service-role only,
  column revoked from clients — but rotate/replace with admin `generateLink` or signed
  session issuance).
- [ ] Local Supabase stack (`supabase init` + config.toml) for RPC-level integration
  tests; current suite mocks the client boundary only.
- [ ] `react-refresh/only-export-components` lint errors in `Icon.tsx` / `Toast.tsx`
  (split non-component exports into separate files).
- [ ] Legacy public storage buckets (`delivery-signatures`, `receiving-files`) still hold
  old rows; migrate or archive, then delete buckets.

## Done
- [x] 2026-07-21 — Receiving broken: code inserted dropped column
  `receiving_log_entries.vendor_id`; restored as FK to `vendors`
  (`20260721000000_restore_receiving_vendor_id.sql`).
- [x] 2026-07-21 — Per-project locations (job site / rigging yard / warehouse staging),
  `rigging_yard` location type, `locations.project_id`, backfill for legacy projects
  (fixed "Kulka - Fieldstone" missing job site), `return` movement type,
  `ensure_project_locations` RPC replacing fragile client-side sync.
- [x] 2026-07-21 — Audit cleanup (stale docs/worktree/dead Sortly refs), lint 52→2,
  starter Vitest suite (59 tests).
