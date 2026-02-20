# Button Variant Cleanup (Inventory & Procurement) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize `<Button>` usage in inventory/procurement UIs by replacing ad-hoc Tailwind classes with explicit `variant`/`size` props per design mapping.

**Architecture:** Pure UI refactor across Next.js client/server components. Update Button instances to use semantic variants (default, destructive, success, warning, secondary, outline, ghost, link) and sizes (sm, icon, icon-sm) while removing redundant styling classes. No backend/schema changes.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind (via shared `Button` component).

---

### Task 1: Update inventory shared components

**Files:**
- Modify: `components/inventory/StockOpnameRecorder.tsx`
- Modify: `components/inventory/EnhancedOpnameForm.tsx`
- Modify: `components/inventory/TransferTable.tsx`
- Modify: `components/inventory/TransferForm.tsx`
- Modify: `components/inventory/StockReport.tsx`
- Modify: `components/inventory/RestockSettingsForm.tsx`
- Modify: `components/inventory/PhotoUpload.tsx`
- Modify: `components/inventory/PhotoThumbnail.tsx`
- Modify: `components/inventory/PhotoGallery.tsx`
- Modify: `components/inventory/OpnameTable.tsx`
- Modify: `components/inventory/OpnameReportTable.tsx`
- Modify: `components/inventory/OpnameForm.tsx`
- Modify: `components/inventory/MasukTable.tsx`
- Modify: `components/inventory/MasukForm.tsx`
- Modify: `components/inventory/KeluarTable.tsx`
- Modify: `components/inventory/KeluarForm.tsx`
- Modify: `components/inventory/GudangForm.tsx`
- Modify: `components/inventory/DetailMasukModal.tsx`
- Modify: `components/inventory/DetailKeluarModal.tsx`
- Modify: `components/inventory/dashboard/MovementRanking.tsx`
- Modify: `components/inventory/dashboard/MonthlyTrendChart.tsx`
- Modify: `components/inventory/BarangTable.tsx`
- Modify: `components/inventory/BarangForm.tsx`
- Modify: `components/inventory/assets/CreateAssetForm.tsx`
- Modify: `components/inventory/assets/AssetDetailView.tsx`
- Modify: `components/inventory/assets/AssetTable.tsx`
- Modify: `components/inventory/dashboard/StockAlerts.tsx`
- Modify: `components/inventory/dashboard/RecentActivities.tsx`
- Modify: `components/inventory/dashboard/ExtendedStatsCards.tsx`
- Modify: `components/inventory/InventoryStats.tsx`

**Steps:**
1) For each `<Button>` lacking `variant`/`size`, map Tailwind colors to variants: red → `destructive`, green/emerald → `success`, orange/amber → `warning`, gray/slate/zinc → `secondary`, border+white → `outline`, text-only actions → `ghost`, underline/text-primary links → `link`, indigo/blue solids → default.
2) Apply size mapping: `px-2 py-1` or `text-xs/sm` → `size="sm"`; icon-only `h-8 w-8 p-1` → `size="icon-sm"`; icon-only `p-2 h-9` → `size="icon"`; remove padding/rounded classes superseded by Button defaults.
3) Keep layout/spacing classes only (flex, gap, w-full, justify-between). Drop redundant bg/text/hover/transition/focus/disabled styles covered by `variant`/`size`. Remove empty `className` when cleared.
4) Re-run a quick search to ensure no remaining `<Button>` in these files lacks `variant` unless default is intended.

### Task 2: Update inventory app pages/clients

**Files:**
- Modify: `app/admin/inventory/transfer/TransferList.tsx`
- Modify: `app/admin/inventory/restock/RestockList.tsx`
- Modify: `app/admin/inventory/opname/OpnameList.tsx`
- Modify: `app/admin/inventory/masuk/MasukList.tsx`
- Modify: `app/admin/inventory/keluar/KeluarList.tsx`
- Modify: `app/admin/inventory/gudang/GudangList.tsx`
- Modify: `app/admin/inventory/barang/[id]/BarangDetailClient.tsx`
- Modify: `app/admin/inventory/barang/[id]/edit/BarangEditClient.tsx`
- Modify: `app/admin/inventory/barang/[id]/edit/GudangEditClient.tsx`
- Modify: `app/admin/inventory/barang/BarangList.tsx`
- Modify: `app/admin/inventory/InventoryIndexClient.tsx`

**Steps:**
1) Normalize Buttons per mapping (solid colors → variants, text actions → `ghost`/`link`, outline buttons → `outline`).
2) Set `size` for small or icon-only Buttons; remove manual padding where size covers it.
3) Strip redundant color/hover/rounded classes; keep layout widths/gaps.
4) Confirm no inventory admin Buttons remain without appropriate variant.

### Task 3: Update inventory app shared components

**Files:**
- Modify: `app/components/inventory/PhotoUpload.tsx`
- Modify: `app/components/inventory/KembaliBarangPlaceholder.tsx`
- Modify: `app/components/inventory/AmbilBarangForm.tsx`

**Steps:**
1) Apply variant mapping to destructive/delete and primary actions; default for neutral submits.
2) Ensure small or icon sizing matches padding; clean className leftovers.

### Task 4: Update procurement shared components

**Files:**
- Modify: `components/procurement/MarketPriceCheck.tsx`

**Steps:**
1) Map solid colors to variants, text-only to `ghost`/`link`, outline where bordered; set sizes for small/icon Buttons.
2) Remove redundant styling classes and empty `className` props.

### Task 5: Update procurement admin pages/components

**Files:**
- Modify: `app/admin/procurement/page.tsx`
- Modify: `app/admin/procurement/market-price/page.tsx`
- Modify: `app/admin/procurement/ProcurementIndexClient.tsx`
- Modify: `app/admin/procurement/suppliers/page.tsx`
- Modify: `app/admin/procurement/suppliers/_components/SupplierForm.tsx`
- Modify: `app/admin/procurement/purchase-orders/page.tsx`
- Modify: `app/admin/procurement/purchase-orders/[id]/page.tsx`
- Modify: `app/admin/procurement/purchase-orders/_components/ReceiveGoodsModal.tsx`
- Modify: `app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx`
- Modify: `app/admin/procurement/purchase-orders/_components/PurchaseOrderForm.tsx`
- Modify: `app/admin/procurement/suppliers/create/page.tsx`
- Modify: `app/admin/procurement/suppliers/[id]/page.tsx`
- Modify: `app/admin/procurement/purchase-orders/create/page.tsx`

**Steps:**
1) Normalize Buttons per mapping (primary → default, approvals/green → `success`, warnings → `warning`, destructive → `destructive`, neutral gray → `secondary`, bordered white → `outline`, text actions → `ghost`/`link`).
2) Apply `size="sm"` where small padding/text was manual; use `size="icon"`/`icon-sm` for icon-only toggles; remove overlapping padding/rounded classes.
3) Ensure modal/footer Button groups keep spacing/width classes only.

### Task 6: Quick verification

**Steps:**
1) Run a scoped search (`grep "<Button"`) to confirm remaining inventory/procurement Buttons use correct `variant`/`size` or intentionally default.
2) (Optional) Run `npm run lint` to catch stray className warnings.
