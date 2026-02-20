# Button Variant Cleanup (Agent B) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align Button usages in finance, marketing, pengaturan, and roles with design variants/sizes, removing ad-hoc styling while keeping layouts intact.

**Architecture:** Normalize Button props to design mapping (primary/default, destructive red, success green, warning amber, secondary gray, outline, ghost, link). Strip redundant Tailwind classes already provided by Button variants, keeping only layout/sizing wrappers. Avoid excluded shared components.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind v4 shared `components/ui/Button`.

---

### Task 1: Finance accounts actions (treasury/add/transfer)

**Files:**
- Modify: `app/admin/finance/accounts/TreasuryClient.tsx`
- Modify: `app/admin/finance/accounts/AddAccountModal.tsx`
- Modify: `app/admin/finance/accounts/TransferModal.tsx`

**Step 1: Inspect Button usages missing `variant`/`size` and note intent (primary, outline, destructive, ghost).**

**Step 2: Apply design mapping (default primary, destructive red, outline for bordered white, ghost for icon-only) and size (`sm` for compact, `icon`/`icon-sm` for icon buttons). Remove redundant bg/text/hover/rounded/px/py when covered by variant/size; drop empty `className`.**

**Step 3: Re-run quick type/lint on touched files.**

Run: `npm run lint -- app/admin/finance/accounts/TreasuryClient.tsx app/admin/finance/accounts/AddAccountModal.tsx app/admin/finance/accounts/TransferModal.tsx`

Expected: lint passes.

### Task 2: Finance expenses/revenue/transactions

**Files:**
- Modify: `app/admin/finance/pengeluaran/ExpenseClient.tsx`
- Modify: `app/admin/finance/pendapatan-harian/DailyRevenueList.tsx`
- Modify: `app/admin/finance/transactions/TransactionsClient.tsx`

**Step 1: Find Buttons lacking `variant`/`size` (e.g., add/export/filter/delete). Classify intent per color/icon sizing.**

**Step 2: Set proper `variant` (`default` primary, `destructive`, `secondary/outline`, `ghost`, `link`) and `size` where compact. Remove redundant styling; keep layout-specific width/gap/justify.**

**Step 3: Lint targeted files.**

Run: `npm run lint -- app/admin/finance/pengeluaran/ExpenseClient.tsx app/admin/finance/pendapatan-harian/DailyRevenueList.tsx app/admin/finance/transactions/TransactionsClient.tsx`

Expected: lint passes.

### Task 3: Finance receivables/unpaid/debts/categories

**Files:**
- Modify: `app/admin/finance/receivables/ReceivablesClient.tsx`
- Modify: `app/admin/finance/unpaid/UnpaidBillsClient.tsx`
- Modify: `app/admin/finance/debts-receivables/DebtsReceivablesClient.tsx`
- Modify: `app/admin/finance/categories/CategoriesClient.tsx`

**Step 1: Audit Buttons for missing `variant`/`size` (e.g., add/edit/delete/export/status toggles). Determine correct design intent per mapping.**

**Step 2: Apply variants/sizes, remove redundant utility classes, ensure no empty `className`. Preserve layout widths/flex spacing only.**

**Step 3: Lint touched files.**

Run: `npm run lint -- app/admin/finance/receivables/ReceivablesClient.tsx app/admin/finance/unpaid/UnpaidBillsClient.tsx app/admin/finance/debts-receivables/DebtsReceivablesClient.tsx app/admin/finance/categories/CategoriesClient.tsx`

Expected: lint passes.

### Task 4: Marketing (sales, coupons, canvasing, dashboard)

**Files:**
- Modify: `app/admin/marketing/sales/SalesListClient.tsx`
- Modify: `app/admin/marketing/sales/[id]/SalesDetailClient.tsx`
- Modify: `app/admin/marketing/sales-dashboard/SalesDashboardClient.tsx`
- Modify: `app/admin/marketing/sales/[id]/SalesPerformanceStats.tsx`
- Modify: `app/admin/marketing/coupons/CouponForm.tsx`
- Modify: `app/admin/marketing/coupons/CouponList.tsx`
- Modify: `app/admin/marketing/canvasing/CanvasingList.tsx`
- Modify: `app/admin/marketing/canvasing/[id]/CanvasingDetailClient.tsx`
- Modify: `app/admin/marketing/canvasing/[id]/edit/CanvasingEditClient.tsx`
- Modify: `app/admin/marketing/canvasing/new/CanvasingCreateClient.tsx`

**Step 1: Identify Buttons missing `variant`/`size` (create/add/export/share/edit/delete/filter). Map color to design variants; choose `ghost` for icon-only, `link` for textual links, `sm` for compact.**

**Step 2: Replace inline styles with variant/size props, remove redundant Tailwind classes, keep layout widths/gaps. Drop empty `className`.**

**Step 3: Lint targeted marketing files.**

Run: `npm run lint -- app/admin/marketing/sales/SalesListClient.tsx app/admin/marketing/sales/[id]/SalesDetailClient.tsx app/admin/marketing/sales-dashboard/SalesDashboardClient.tsx app/admin/marketing/sales/[id]/SalesPerformanceStats.tsx app/admin/marketing/coupons/CouponForm.tsx app/admin/marketing/coupons/CouponList.tsx app/admin/marketing/canvasing/CanvasingList.tsx app/admin/marketing/canvasing/[id]/CanvasingDetailClient.tsx app/admin/marketing/canvasing/[id]/edit/CanvasingEditClient.tsx app/admin/marketing/canvasing/new/CanvasingCreateClient.tsx`

Expected: lint passes.

### Task 5: Pengaturan/settings (api/app-version/captcha/company-bank-accounts/email/logo/payment/umum/whatsapp)

**Files:**
- Modify: `app/admin/pengaturan/api/ApiSettingsClient.tsx`
- Modify: `app/admin/pengaturan/app-version/AppVersionClient.tsx`
- Modify: `app/admin/pengaturan/captcha/CaptchaClient.tsx`
- Modify: `app/admin/pengaturan/company-bank-accounts/BankAccountsClient.tsx`
- Modify: `app/admin/pengaturan/email/EmailSettingsClient.tsx`
- Modify: `app/admin/pengaturan/logo/LogoSettingsClient.tsx`
- Modify: `app/admin/pengaturan/nada-dering/RingtoneSettingsClient.tsx`
- Modify: `app/admin/pengaturan/payment-gateway/PaymentSettingsClient.tsx`
- Modify: `app/admin/pengaturan/payment-gateway/components/PaymentGatewayTab.tsx`
- Modify: `app/admin/pengaturan/payment-gateway/components/ManualTransferTab.tsx`
- Modify: `app/admin/pengaturan/umum/GeneralSettingsClient.tsx`
- Modify: `app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`

**Step 1: Locate Buttons without `variant`/`size` (save/test/check/enable/refresh). Determine proper variant per mapping; assign compact sizes where applicable.**

**Step 2: Convert inline styles to variant/size props, remove redundant color/hover/padding classes, keep layout widths/margins only. Remove empty `className`.**

**Step 3: Lint updated settings files.**

Run: `npm run lint -- app/admin/pengaturan/api/ApiSettingsClient.tsx app/admin/pengaturan/app-version/AppVersionClient.tsx app/admin/pengaturan/captcha/CaptchaClient.tsx app/admin/pengaturan/company-bank-accounts/BankAccountsClient.tsx app/admin/pengaturan/email/EmailSettingsClient.tsx app/admin/pengaturan/logo/LogoSettingsClient.tsx app/admin/pengaturan/nada-dering/RingtoneSettingsClient.tsx app/admin/pengaturan/payment-gateway/PaymentSettingsClient.tsx app/admin/pengaturan/payment-gateway/components/PaymentGatewayTab.tsx app/admin/pengaturan/payment-gateway/components/ManualTransferTab.tsx app/admin/pengaturan/umum/GeneralSettingsClient.tsx app/admin/pengaturan/whatsapp/WhatsappSettingsClient.tsx`

Expected: lint passes.

### Task 6: Roles pages

**Files:**
- Modify: `app/admin/settings/roles/RolesClient.tsx`
- Modify: `app/admin/settings/roles/page.tsx`

**Step 1: Audit Buttons lacking `variant`/`size` (create/edit/delete permissions). Determine correct variants (`default`, `outline/secondary`, `destructive`, `ghost`, `link`) and sizes.**

**Step 2: Apply variant/size, strip redundant styling, keep layout spacing. Remove empty `className`.**

**Step 3: Lint roles files.**

Run: `npm run lint -- app/admin/settings/roles/RolesClient.tsx app/admin/settings/roles/page.tsx`

Expected: lint passes.

### Task 7: Final sweep

**Files:**
- Modify: any remaining scoped files where Buttons still lack variant/size after above tasks.

**Step 1: Re-scan scoped directories for `<Button` without `variant` in finance/marketing/pengaturan/roles.**

**Step 2: Fix any stragglers per mapping, ensure no empty `className`.**

**Step 3: Optional lint on all touched files.**

Run: `npm run lint -- <touched files>`

Expected: lint passes.
