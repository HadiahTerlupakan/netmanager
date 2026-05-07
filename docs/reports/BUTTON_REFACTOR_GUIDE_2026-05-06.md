# Button Refactor Implementation Guide

**Tanggal:** 2026-05-06  
**Status:** In Progress (3/70+ files completed)

## Progress Summary

### Completed ✅
1. **Global dark mode fix** - `components/ui/Button.tsx`
   - All `default`, `destructive`, `success`, `warning` variants now auto-adapt to dark mode
   - Pattern: `dark:bg-{color}/20 dark:text-{color} dark:border dark:border-{color}/30`

2. **Admin users area** (2 files)
   - `app/admin/users/UserList.tsx`
   - `app/admin/users/components/UserTable.tsx`

3. **Admin pengaturan** (1 file)
   - `app/admin/pengaturan/captcha/CaptchaClient.tsx`

### Remaining 🔄
- Admin pengaturan: 9 files
- Admin paket: 6 files
- Admin tenants: 2 files
- Admin inventory: 3 files
- Admin workorders: 8 files
- Admin pelanggan: 8 files
- Admin marketing: 3 files
- Admin finance: 2 files
- Admin salary: 3 files
- Admin integrations: 6 files
- Components shared: 3 files
- Error pages: 3 files

**Total remaining:** ~67 files

## Refactor Pattern

### Standard Button Replacement

**Before:**
```tsx
<button
  className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"
>
  Action
</button>
```

**After:**
```tsx
import { Button } from "@/components/ui/Button";

<Button variant="default">
  Action
</Button>
```

### Link as Button Replacement

**Before:**
```tsx
<Link
  href="/path"
  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 dark:bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
>
  <Icon className="w-5 h-5 text-white" />
  <span className="text-white">Text</span>
</Link>
```

**After:**
```tsx
import { buttonVariants } from "@/components/ui/Button";

<Link
  href="/path"
  className={buttonVariants({ variant: "default" })}
>
  <Icon className="w-5 h-5" />
  <span>Text</span>
</Link>
```

### Cleanup Rules

1. **Remove redundant classes:**
   - `text-white` (handled by variant)
   - `inline-flex items-center gap-2` (handled by base styles)
   - `px-4 py-2` or `px-5 py-2.5` (handled by size)
   - `rounded-lg` (handled by base)
   - `transition-colors` (handled by base)
   - `shadow-sm` (handled by variant)

2. **Remove redundant icon classes:**
   - `text-white` on icons
   - `w-5 h-5` (handled by base `[&_svg]:size-4`)

3. **Keep necessary classes:**
   - Layout: `w-full`, `flex-1`, `self-start`
   - Custom spacing: jika berbeda dari default
   - Custom styling: jika memang unik untuk konteks tertentu

## Files to Refactor (Priority Order)

### Batch 1: Admin Pengaturan (9 files remaining)
- [ ] `/app/admin/pengaturan/app-version/AppVersionClient.tsx` (3 buttons)
- [ ] `/app/admin/pengaturan/api/ApiSettingsClient.tsx` (1 button)
- [ ] `/app/admin/pengaturan/nada-dering/RingtoneSettingsClient.tsx` (1 button)
- [ ] `/app/admin/pengaturan/logo/LogoSettingsClient.tsx` (3 buttons)

### Batch 2: Admin Paket (6 files)
- [ ] `/app/admin/paket/bandwidth/components/BandwidthTable.tsx`
- [ ] `/app/admin/paket/bandwidth/components/BandwidthFormModal.tsx`
- [ ] `/app/admin/paket/profileppp/components/ProfilePppTable.tsx`
- [ ] `/app/admin/paket/profileppp/components/ProfilePppFormModal.tsx`
- [ ] `/app/admin/paket/harga/components/HargaTable.tsx`
- [ ] `/app/admin/paket/harga/components/HargaFormModal.tsx`

### Batch 3: Admin Tenants (2 files)
- [ ] `/app/admin/tenants/TenantList.tsx` (3 buttons)
- [ ] `/app/admin/tenants/TenantAdminList.tsx` (2 buttons)

### Batch 4: Admin Inventory (3 files)
- [ ] `/app/admin/inventory/gudang/GudangList.tsx` (2 buttons)
- [ ] `/app/admin/inventory/barang/BarangList.tsx` (1 button)
- [ ] `/components/inventory/DetailKeluarModal.tsx` (1 button)

### Batch 5: Admin Workorders (8 files)
- [ ] `/app/admin/workorders/departments/DeptIndexClient.tsx`
- [ ] `/app/admin/workorders/departments/new/DeptNewClient.tsx`
- [ ] `/app/admin/workorders/departments/[id]/edit/DeptEditClient.tsx`
- [ ] `/app/admin/workorders/sites/SitesList.tsx`
- [ ] `/app/admin/workorders/sites/new/SitesNewClient.tsx`
- [ ] `/app/admin/workorders/sites/[id]/SiteDetailClient.tsx`
- [ ] `/app/admin/workorders/sites/[id]/edit/SitesEditClient.tsx`
- [ ] `/app/admin/workorders/templates/TemplatesClient.tsx`
- [ ] `/app/admin/workorders/[id]/components/WoMaterialsTab.tsx`

### Batch 6: Admin Pelanggan (8 files)
- [ ] `/app/admin/pelanggan/ppp/components/actions/PppClientFormActions.tsx`
- [ ] `/app/admin/pelanggan/ppp/[id]/PppDetailClient.tsx`
- [ ] `/app/admin/pelanggan/ppp/[id]/renew/PppRenewClient.tsx` (3 buttons)
- [ ] `/app/admin/pelanggan/ppp/[id]/print/PppPrintClient.tsx` (2 buttons)

### Batch 7: Admin Marketing (3 files)
- [ ] `/app/admin/marketing/canvasing/[id]/CanvasingDetailClient.tsx`
- [ ] `/app/admin/marketing/sales/SalesListClient.tsx`

### Batch 8: Admin Finance (2 files)
- [ ] `/app/admin/finance/manual-payments/ManualPaymentClient.tsx`

### Batch 9: Admin Salary (3 files)
- [ ] `/app/admin/salary/slip/[id]/SlipPrintClient.tsx`
- [ ] `/app/admin/salary/users/SalaryUsersClient.tsx`
- [ ] `/app/admin/salary/[id]/SalaryDetailClient.tsx`

### Batch 10: Admin Integrations (6 files)
- [ ] `/app/admin/integrations/mixradius/expenses/RABView.tsx` (2 buttons)
- [ ] `/app/admin/integrations/mixradius/expenses/RABList.tsx`
- [ ] `/app/admin/integrations/mixradius/expenses/RABCompare.tsx`
- [ ] `/app/admin/integrations/mixradius/investor-sites/SiteInvestorClient.tsx` (2 buttons)
- [ ] `/app/admin/integrations/mixradius/expenses/ItemDisbursementModal.tsx`

### Batch 11: Components Shared (3 files)
- [ ] `/components/admin/radius/sync-controls.tsx`
- [ ] `/components/procurement/MarketPriceCheck.tsx`
- [ ] `/components/admin/logo/LogoUploadCard.tsx`

### Batch 12: Error Pages (3 files)
- [ ] `/app/error.tsx`
- [ ] `/app/global-error.tsx`
- [ ] `/app/not-found.tsx`
- [ ] `/app/(auth)/error/page.tsx`
- [ ] `/app/admin/forbidden/page.tsx`

### Batch 13: Network (1 file)
- [ ] `/app/admin/network/mikrotik/components/mikrotikRouterTable.tsx`

### Batch 14: Mitra & Investors (2 files)
- [ ] `/app/admin/mitra/MitraListClient.tsx` (3 buttons)
- [ ] `/app/admin/investors/InvestorsClient.tsx` (3 buttons)

## Red Flag Files (Handle Last)

These files need special attention and may require custom variants or stay manual:

1. **`/app/mitra-id/[id]/IdCardClient.tsx`**
   - Issue: `rounded-full shadow-xl active:bg-indigo-800`
   - Solution: Keep manual or create `variant="id-card"`

2. **`/app/admin/inventory/restock/*`** (3 files)
   - Issue: `font-black uppercase rounded-2xl active:scale-95`
   - Solution: Keep manual or create `variant="restock"`

3. **`/app/admin/users/compare/UsersCompareClient.tsx`**
   - Issue: Tab selector with conditional state
   - Solution: Keep manual or use Tabs component

4. **`/app/admin/workorders/[id]/components/WoDiscussionTab.tsx`**
   - Issue: Scale animation `hover:scale-105 active:scale-95`
   - Solution: Keep manual

5. **`/app/admin/integrations/mixradius/expenses/RABForm.tsx`**
   - Issue: Complex conditional styling
   - Solution: Review case-by-case

## Validation Checklist

After each batch:
- [ ] Run `npm run typecheck`
- [ ] Spot check 2-3 pages in browser (light + dark mode)
- [ ] Verify no visual regression

After all batches:
- [ ] Run full E2E test suite
- [ ] Visual regression test critical paths
- [ ] Update documentation

## Estimated Timeline

- **Per file:** 2-3 minutes
- **67 files remaining:** ~2-3 hours
- **Red flag handling:** 1 hour
- **Testing & validation:** 30 minutes
- **Total:** ~4-5 hours

## Recommendation

Given the large scope (67 files), consider:

1. **Option A: Continue manual refactor**
   - Pros: Full control, can handle edge cases
   - Cons: Time-consuming, repetitive

2. **Option B: Automated script with manual review**
   - Create regex-based replacement script
   - Review each change before commit
   - Faster but needs careful validation

3. **Option C: Incremental by feature area**
   - Refactor one admin area at a time
   - Test thoroughly after each area
   - Deploy incrementally

**Recommended:** Option C - safer and allows for incremental validation.

## Current Status

**Time:** 23:12 WIB  
**Progress:** 3/70 files (4%)  
**Next:** Continue with admin pengaturan batch (9 files)
