# Integrasi Module — Fix CRITICAL, HIGH & MEDIUM Bugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 CRITICAL bugs (fitur broken), 5 HIGH bugs (data salah/broken UX), dan 12 MEDIUM bugs (logic/UX issues) yang ditemukan pada review fungsionalitas modul Integrasi.

**Architecture:** Semua fix dilakukan in-place tanpa perubahan arsitektur. Fokus pada perbaikan logic, field mapping, response handling, dan state management.

**Tech Stack:** Next.js 14, TypeScript, React, Zod, Prisma

---

## File Structure

| File | Perubahan |
|------|-----------|
| `modules/integrations/validators/MixRadiusConfigValidator.ts` | Fix field names di Zod schema |
| `app/admin/integrations/mixradius/profit-loss/ProfitLossClient.tsx` | Fix response unwrap |
| `app/admin/integrations/mixradius/income-period/hooks/useRoiTracking.ts` | Fix response field access |
| `app/admin/integrations/mixradius/income-period/hooks/useIncomePeriodData.ts` | Fix expense data parsing |
| `app/admin/integrations/mixradius/income-period/components/SummaryCards.tsx` | Fix double-deduction |
| `app/admin/integrations/mixradius/expenses/RABView.tsx` | Fix Object.assign prop mutation |
| `modules/integrations/services/mixradius-income-filters.ts` | Fix numeric sort |
| `app/api/integrations/mixradius/reports/period/route.ts` | Remove redundant fetch |
| `app/api/integrations/mixradius/groups/route.ts` | Fix isActive handling |
| `app/api/integrations/mixradius/groups/[id]/route.ts` | Fix permissions + validation |
| `modules/integrations/services/MixRadiusGroupRouteService.ts` | Fix tenant isolation |
| `app/admin/integrations/mixradius/MixRadiusClient.tsx` | Fix invoice status + dismantle modal |
| `modules/integrations/services/MixRadiusProfitLossService.ts` | Fix date filter + fees |

---

## PHASE 1: CRITICAL FIXES (Fitur Broken)

### Task 1: Fix Zod schema field names — Account CREATE broken

**Files:**
- Modify: `modules/integrations/validators/MixRadiusConfigValidator.ts`

**Problem:** Client kirim `baseUrl` + `isActive`, tapi Zod schema expect `apiUrl` + `isDefault`. CREATE selalu gagal validasi.

- [ ] **Step 1: Fix schema field names**

```typescript
export const mixRadiusConfigCreateSchema = z.object({
  name: z.string().min(1, "Nama konfigurasi wajib diisi"),
  baseUrl: z.string().min(1, "URL wajib diisi"),
  username: z.string().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
  isActive: z.boolean().optional().default(false),
  tenantId: z.string().optional(),
});

export const mixRadiusConfigUpdateSchema = mixRadiusConfigCreateSchema.partial();
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add modules/integrations/validators/MixRadiusConfigValidator.ts
git commit -m "fix(integrations): align Zod schema fields with client payload (baseUrl/isActive)"
```

---

### Task 2: Fix ProfitLossClient — tidak unwrap API envelope

**Files:**
- Modify: `app/admin/integrations/mixradius/profit-loss/ProfitLossClient.tsx`

**Problem:** `setData(json)` seharusnya `setData(json.data)`. API return `{ success, data: {...} }` via `apiSuccess()`.

- [ ] **Step 1: Fix response unwrap di fetchData**

Ganti block fetch handler (sekitar line 98-117):

```typescript
const fetchData = async () => {
  setLoading(true);
  setError(null);
  try {
    const params = new URLSearchParams({ startDate, endDate });
    const res = await fetch(
      `/api/integrations/mixradius/profit-loss?${params}`,
    );
    const json = await res.json();
    if (json.success && json.data) {
      if (json.data.isConfigError) {
        setError(json.data.error);
        setData(json.data);
      } else {
        setData(json.data);
      }
    } else {
      setError(json.error || "Gagal mengambil data");
    }
  } catch (error) {
    clientLogger.error("Failed to fetch P&L", error);
    setError("Gagal mengambil data dari server. Silakan coba lagi.");
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | head -5`

- [ ] **Step 3: Commit**

```bash
git add app/admin/integrations/mixradius/profit-loss/ProfitLossClient.tsx
git commit -m "fix(integrations): unwrap apiSuccess envelope in ProfitLossClient"
```

---

### Task 3: Fix ROI Tracking — akses field response yang salah

**Files:**
- Modify: `app/admin/integrations/mixradius/income-period/hooks/useRoiTracking.ts`

**Problem:** Hook akses `revenueData.summaryProfit` (undefined). Seharusnya `revenueData.data.summary.profit`. Juga `revenueData.data` bukan array records — records ada di `revenueData.data.data`.

- [ ] **Step 1: Read current file to identify exact lines**

- [ ] **Step 2: Fix response field access**

Ganti akses response dari:
```typescript
summaryProfit: revenueData.summaryProfit,
summarySellerFee: revenueData.summarySellerFee,
records: revenueData.data,
```

Ke:
```typescript
summaryProfit: revenueData.data?.summary?.profit,
summarySellerFee: revenueData.data?.summary?.feeSeller,
records: revenueData.data?.data ?? [],
```

- [ ] **Step 3: Verify typecheck passes**

- [ ] **Step 4: Commit**

```bash
git add app/admin/integrations/mixradius/income-period/hooks/useRoiTracking.ts
git commit -m "fix(integrations): fix ROI tracking response field access paths"
```

---

### Task 4: Fix RABView — Object.assign prop mutation

**Files:**
- Modify: `app/admin/integrations/mixradius/expenses/RABView.tsx`

**Problem:** `Object.assign(data, {...})` mutasi props langsung. React tidak detect perubahan, UI stale, double-approve possible.

- [ ] **Step 1: Read RABView.tsx lines 320-400 untuk context**

- [ ] **Step 2: Replace Object.assign dengan onRefresh callback**

Di `handleStatusTransition` (sekitar line 338):
```typescript
// BEFORE: Object.assign(data, { status: newStatus });
// AFTER:
onRefresh?.();
```

Di approval handler (sekitar line 391):
```typescript
// BEFORE: Object.assign(data, json.data);
// AFTER:
onRefresh?.();
```

- [ ] **Step 3: Verify typecheck passes**

- [ ] **Step 4: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/RABView.tsx
git commit -m "fix(integrations): replace Object.assign prop mutation with onRefresh callback"
```

---

### Task 5: Fix Income Period — expense data never loaded

**Files:**
- Modify: `app/admin/integrations/mixradius/income-period/hooks/useIncomePeriodData.ts`

**Problem:** API return `{ success: true, data: [...] }` tapi hook cek `Array.isArray(json)` yang selalu false.

- [ ] **Step 1: Read useIncomePeriodData.ts lines 380-450 untuk context**

- [ ] **Step 2: Fix expense response parsing**

Ganti:
```typescript
const specificExpenseItems = Array.isArray(specificJson) ? specificJson : [];
```
Dengan:
```typescript
const specificExpenseItems = Array.isArray(specificJson?.data) ? specificJson.data : [];
```

Dan ganti:
```typescript
if (Array.isArray(expData)) { ... }
```
Dengan:
```typescript
const expenseItems = Array.isArray(expData?.data) ? expData.data : [];
if (expenseItems.length > 0) { ... }
```

- [ ] **Step 3: Verify typecheck passes**

- [ ] **Step 4: Commit**

```bash
git add app/admin/integrations/mixradius/income-period/hooks/useIncomePeriodData.ts
git commit -m "fix(integrations): unwrap apiSuccess envelope for expense data in income period"
```

---

## PHASE 1.5: HIGH FIXES (Data Salah / Broken UX)

### Task 5A: Fix Akun GET response — isDefault vs isActive field mapping

**Files:**
- Modify: `app/admin/integrations/mixradius/accounts/MixRadiusAccountsClient.tsx`

**Problem:** API return `isDefault: true` tapi client interface expect `isActive`. Kolom status selalu tampil "Tidak Aktif" untuk semua akun. Tombol "Aktifkan" selalu muncul.

- [ ] **Step 1: Read MixRadiusAccountsClient.tsx — cari interface dan fetchData mapping**

- [ ] **Step 2: Map `isDefault` ke `isActive` saat fetch data**

Di `fetchData` response handler, map field:
```typescript
const configs = json.data.map((config: any) => ({
  ...config,
  isActive: config.isDefault ?? config.isActive ?? false,
}));
setAccounts(configs);
```

Atau fix di interface:
```typescript
interface MixRadiusConfig {
  // ...
  isActive: boolean; // mapped from isDefault
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `npx tsc --noEmit 2>&1 | grep "error TS" | head -5`

- [ ] **Step 4: Commit**

```bash
git add app/admin/integrations/mixradius/accounts/MixRadiusAccountsClient.tsx
git commit -m "fix(integrations): map isDefault to isActive in accounts client"
```

---

### Task 5B: Fix Laba Rugi — fetchProfitReport ignores siteId parameter

**Files:**
- Modify: `modules/integrations/services/MixRadiusService.ts`
- Modify: `modules/integrations/services/MixRadiusProfitLossService.ts`

**Problem:** `MixRadiusService.fetchProfitReport(_groupId)` menerima parameter tapi tidak pernah digunakan (prefixed `_`). Monthly breakdown dan chart tampil data semua site meskipun user pilih site tertentu.

- [ ] **Step 1: Read fetchProfitReport di MixRadiusService.ts (sekitar line 267-275)**

- [ ] **Step 2: Jika upstream API support filter by group/site, pass parameter**

Jika MixRadius upstream tidak support filter (likely — ini scraping), maka filter harus dilakukan setelah fetch:

```typescript
// Di MixRadiusProfitLossService, setelah mendapat profitData:
// Filter monthly aggregates by siteId jika diberikan
if (siteId) {
  // Hanya include income dari owner yang terkait site tersebut
  // Ini memerlukan lookup owners by siteId
}
```

Alternatif pragmatic: jika siteId diberikan, skip profitData (yang full year) dan gunakan income dari `fetchIncomeSummary` yang sudah filtered.

- [ ] **Step 3: Verify typecheck passes**

- [ ] **Step 4: Commit**

```bash
git add modules/integrations/services/MixRadiusService.ts modules/integrations/services/MixRadiusProfitLossService.ts
git commit -m "fix(integrations): respect siteId filter in profit-loss monthly breakdown"
```

---

### Task 5C: Fix Dashboard — isRefreshing useEffect double-fetch

**Files:**
- Modify: `app/admin/integrations/mixradius/MixRadiusClient.tsx`

**Problem:** `isRefreshing` ada di useEffect dependency array. Saat `setIsRefreshing(false)` dipanggil di dalam effect, effect re-trigger dan fetch invoice counts kedua kali.

- [ ] **Step 1: Read useEffect untuk invoice counts (sekitar line 137-186)**

- [ ] **Step 2: Hapus `isRefreshing` dari dependency array, gunakan ref**

```typescript
const isRefreshingRef = useRef(false);

useEffect(() => {
  if (!data?.data?.length) return;

  const fetchCountsProgressively = async () => {
    // gunakan isRefreshingRef.current untuk bypassCache
    const bypassCache = isRefreshingRef.current;
    // ... existing logic ...
    isRefreshingRef.current = false;
    setIsRefreshing(false);
  };

  const timer = setTimeout(fetchCountsProgressively, 500);
  return () => clearTimeout(timer);
}, [data]); // hapus isRefreshing dari deps

// Di handler "Bersihkan Cache":
const handleRefreshCounts = () => {
  isRefreshingRef.current = true;
  setIsRefreshing(true); // untuk UI indicator saja
};
```

- [ ] **Step 3: Verify typecheck passes**

- [ ] **Step 4: Commit**

```bash
git add app/admin/integrations/mixradius/MixRadiusClient.tsx
git commit -m "fix(integrations): prevent double-fetch invoice counts via ref instead of state dep"
```

---

### Task 5D: Fix Pendapatan — redundant double-fetch ke MixRadius

**Files:**
- Modify: `app/api/integrations/mixradius/reports/period/route.ts`

**Problem:** Route memanggil `fetchIncomeByPeriod` DAN `fetchIncomeSummary` secara paralel. `fetchIncomeSummary` internally fetch ulang semua data (limit 10000). Padahal `fetchIncomeByPeriod` sudah return `summary` via `calculateInlineSummary`.

- [ ] **Step 1: Read route.ts — cari Promise.all block**

- [ ] **Step 2: Hapus fetchIncomeSummary, gunakan summary dari fetchIncomeByPeriod**

```typescript
const data = await service.fetchIncomeByPeriod(params);
// data sudah punya .summary dari calculateInlineSummary
return apiSuccess(data);
```

Jika `fetchIncomeByPeriod` belum return summary, tambahkan di response builder.

- [ ] **Step 3: Verify typecheck passes**

- [ ] **Step 4: Commit**

```bash
git add app/api/integrations/mixradius/reports/period/route.ts
git commit -m "fix(integrations): remove redundant fetchIncomeSummary double-fetch"
```

---

### Task 5E: Fix Pendapatan — numeric columns sorted as strings

**Files:**
- Modify: `modules/integrations/services/mixradius-income-filters.ts`

**Problem:** Kolom `total`, `seller_fee`, `price` di-sort lexicographically ("9000" > "80000").

- [ ] **Step 1: Read sortIncomeRecords function**

- [ ] **Step 2: Add numeric sort handling**

```typescript
const NUMERIC_SORT_COLUMNS = new Set(["total", "seller_fee", "price", "tax", "fee"]);

// Di dalam sortIncomeRecords, sebelum string comparison:
if (NUMERIC_SORT_COLUMNS.has(sortBy)) {
  return [...records].sort((a, b) => {
    const numA = parseFloat(String(a[sortBy] || "0").replace(/[^0-9.-]/g, "")) || 0;
    const numB = parseFloat(String(b[sortBy] || "0").replace(/[^0-9.-]/g, "")) || 0;
    return sortDir === "asc" ? numA - numB : numB - numA;
  });
}
```

- [ ] **Step 3: Verify typecheck passes**

- [ ] **Step 4: Commit**

```bash
git add modules/integrations/services/mixradius-income-filters.ts
git commit -m "fix(integrations): sort numeric income columns by value instead of string"
```

---

## PHASE 2: MEDIUM FIXES (Logic/UX Issues)

### Task 6: Fix SummaryCards double-deduction seller fee

**Files:**
- Modify: `app/admin/integrations/mixradius/income-period/components/SummaryCards.tsx`

**Problem:** `grossProfit = profit - feeSeller - gatewayFee` tapi `profit` sudah minus feeSeller.

- [ ] **Step 1: Read SummaryCards.tsx lines 45-55**

- [ ] **Step 2: Fix formula**

```typescript
// profit sudah = total - tax - sellerFee, jadi tidak perlu kurangi lagi
const grossProfit = parseNumber(summary?.profit) - estGatewayFee;
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/integrations/mixradius/income-period/components/SummaryCards.tsx
git commit -m "fix(integrations): remove double-deduction of seller fee in gross profit"
```

---

### Task 7: Fix SummaryCards double-deduction seller fee

**Files:**
- Modify: `app/admin/integrations/mixradius/income-period/components/SummaryCards.tsx`

**Problem:** `grossProfit = profit - feeSeller - gatewayFee` tapi `profit` sudah minus feeSeller.

- [ ] **Step 1: Read SummaryCards.tsx lines 45-55**

- [ ] **Step 2: Fix formula**

```typescript
// profit sudah = total - tax - sellerFee, jadi tidak perlu kurangi lagi
const grossProfit = parseNumber(summary?.profit) - estGatewayFee;
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/integrations/mixradius/income-period/components/SummaryCards.tsx
git commit -m "fix(integrations): remove double-deduction of seller fee in gross profit"
```

---

### Task 8: Fix Laba Rugi — date filter tidak apply ke monthly breakdown

**Files:**
- Modify: `modules/integrations/services/MixRadiusProfitLossService.ts`

**Problem:** `fetchProfitReport()` dan `addYearlyExpenses()` selalu fetch full year, ignore date filter.

- [ ] **Step 1: Read MixRadiusProfitLossService.ts getReport method**

- [ ] **Step 2: Filter monthly breakdown by date range**

Setelah `addYearlyExpenses` dan `addIncomeToAggregates`, filter `monthlyAggregates` hanya untuk bulan yang masuk range:

```typescript
const filteredMonths = Object.entries(monthlyAggregates)
  .filter(([month]) => {
    const monthDate = new Date(month + "-01");
    return monthDate >= startDate && monthDate <= endDate;
  })
  .map(([month, value]) => ({ month, ...value }));
```

- [ ] **Step 3: Commit**

```bash
git add modules/integrations/services/MixRadiusProfitLossService.ts
git commit -m "fix(integrations): apply date filter to monthly breakdown in profit-loss"
```

---

### Task 9: Fix Laba Rugi — fees tidak masuk monthly breakdown

**Files:**
- Modify: `modules/integrations/services/MixRadiusProfitLossService.ts`

**Problem:** `addIncomeToAggregates()` tidak populate `fees` field. Monthly net profit tidak deduct fees.

- [ ] **Step 1: Read addIncomeToAggregates function**

- [ ] **Step 2: Add fees to monthly aggregates**

Dalam loop `addIncomeToAggregates`, tambah:
```typescript
aggregate.fees += profitData.sellerFees[monthIndex] || 0;
```

Dan pastikan `net` dihitung sebagai `income - fees - expense`.

- [ ] **Step 3: Commit**

```bash
git add modules/integrations/services/MixRadiusProfitLossService.ts
git commit -m "fix(integrations): include seller fees in monthly breakdown net calculation"
```

---

### Task 10: Fix Sites/Groups — isActive diabaikan di POST

**Files:**
- Modify: `app/api/integrations/mixradius/groups/route.ts`

**Problem:** POST handler hanya destructure `{ name, owners, siteId }`, `isActive` diabaikan.

- [ ] **Step 1: Read POST handler di groups/route.ts**

- [ ] **Step 2: Add isActive to destructuring and pass to service**

```typescript
const { name, owners, siteId, isActive } = body;
// ...
const group = await service.createOwnerGroup({ name, owners, siteId, isActive, tenantId });
```

- [ ] **Step 3: Commit**

```bash
git add app/api/integrations/mixradius/groups/route.ts
git commit -m "fix(integrations): pass isActive field when creating owner group"
```

---

### Task 11: Fix Sites/Groups — permission mismatch + missing validation di PUT/DELETE

**Files:**
- Modify: `app/api/integrations/mixradius/groups/[id]/route.ts`

**Problem:** PUT/DELETE hanya accept `mixradius:update/delete`, bukan `mixradius_sites:*`. Juga PUT tanpa validation.

- [ ] **Step 1: Read [id]/route.ts**

- [ ] **Step 2: Fix permissions — add mixradius_sites variants**

```typescript
// PUT
requiredPermissions: ["mixradius_sites:update", "mixradius:update"],
// DELETE
requiredPermissions: ["mixradius_sites:delete", "mixradius:delete"],
```

- [ ] **Step 3: Add validation di PUT**

```typescript
const { name, owners, siteId, isActive } = body;
if (!name || typeof name !== "string" || name.trim().length === 0) {
  return ApiErrors.badRequest("Nama group wajib diisi");
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/integrations/mixradius/groups/[id]/route.ts
git commit -m "fix(integrations): align group PUT/DELETE permissions and add validation"
```

---

### Task 12: Fix getMobileGroups tenant isolation

**Files:**
- Modify: `modules/integrations/services/MixRadiusGroupRouteService.ts`

**Problem:** `getMobileGroups` fetch semua groups tanpa tenantId filter.

- [ ] **Step 1: Read getMobileGroups method**

- [ ] **Step 2: Pass tenantId parameter**

```typescript
async getMobileGroups(siteId: string, tenantId?: string) {
  const groups = await this.mixRadiusService.getOwnerGroups(tenantId);
  // ... existing filter by siteId ...
}
```

- [ ] **Step 3: Commit**

```bash
git add modules/integrations/services/MixRadiusGroupRouteService.ts
git commit -m "fix(integrations): add tenant isolation to getMobileGroups"
```

---

### Task 13: Fix Dashboard — invoice status hardcoded + dismantle modal

**Files:**
- Modify: `app/admin/integrations/mixradius/MixRadiusClient.tsx`

**Problem 1:** Invoice status column render "Detail" hardcoded, bukan `inv.status`.
**Problem 2:** Dismantle modal bisa kehilangan `selectedCustomer`.

- [ ] **Step 1: Fix invoice status rendering (sekitar line 1283-1286)**

```tsx
<td className="px-3 py-3 text-sm">
  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
    inv.status === "PAID" || inv.status === "Lunas"
      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
  }`}>
    {inv.status || "Unknown"}
  </span>
</td>
```

- [ ] **Step 2: Fix dismantle modal — capture customer before opening**

Di handler buka dismantle modal, simpan customer ke ref atau state terpisah:
```typescript
const [dismantleCustomer, setDismantleCustomer] = useState<MixRadiusCustomerDetail | null>(null);

// Saat buka dismantle:
setDismantleCustomer(selectedCustomer);
setShowDismantleModal(true);
```

Gunakan `dismantleCustomer` di modal description dan `handleDismantle`.

- [ ] **Step 3: Commit**

```bash
git add app/admin/integrations/mixradius/MixRadiusClient.tsx
git commit -m "fix(integrations): render invoice status and stabilize dismantle modal reference"
```

---

### Task 14: Fix Isolir semantic mismatch

**Files:**
- Modify: `modules/integrations/services/mixradius-customer-filters.ts`

**Problem:** Filter "Isolir" hanya cek expired date, tidak cek `auth_status`. Customer enabled tapi expired masuk list.

- [ ] **Step 1: Read filterByAuthStatus untuk case "Isolir"**

- [ ] **Step 2: Tambah check auth_status disabled OR expired**

```typescript
if (authStatus === "Isolir") {
  return customers.filter(
    (c) => isExpiredCustomer(c) || c.auth_status === "Disabled-Users",
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add modules/integrations/services/mixradius-customer-filters.ts
git commit -m "fix(integrations): include disabled-users in Isolir filter alongside expired"
```

---

### Task 16: Fix RABView — handleStatusTransition tidak panggil onRefresh

**Files:**
- Modify: `app/admin/integrations/mixradius/expenses/RABView.tsx`

**Problem:** Setelah status transition berhasil, parent state tidak di-refresh.

- [ ] **Step 1: Verify onRefresh sudah dipanggil setelah fix Task 4**

Jika Task 4 sudah menambahkan `onRefresh?.()` di kedua tempat, task ini sudah covered. Verify saja.

- [ ] **Step 2: Jika belum, tambahkan onRefresh di handleStatusTransition**

- [ ] **Step 3: Commit (jika ada perubahan tambahan)**

---

### Task 17: Fix Pengeluaran — RABRevisionForm orphan draft cleanup

**Files:**
- Modify: `app/admin/integrations/mixradius/expenses/RABRevisionForm.tsx`

**Problem:** Auto-create draft revision saat modal open. Jika user cancel, draft orphan di DB.

- [ ] **Step 1: Read RABRevisionForm lines 70-90**

- [ ] **Step 2: Add cleanup on modal close**

Tambah `useEffect` cleanup atau `onClose` handler yang delete draft jika belum di-submit:
```typescript
useEffect(() => {
  return () => {
    if (draftRevisionId && !isSubmitted) {
      fetch(`/api/finance/rab-revisions/${draftRevisionId}`, { method: "DELETE" });
    }
  };
}, [draftRevisionId, isSubmitted]);
```

- [ ] **Step 3: Commit**

```bash
git add app/admin/integrations/mixradius/expenses/RABRevisionForm.tsx
git commit -m "fix(integrations): cleanup orphan draft revision on modal close"
```

---

## PHASE 3: REMAINING FIXES (Post Re-Review)

### Task 18: Fix Dashboard clearCache — trigger re-fetch after setting bypass flag

**Files:**
- Modify: `app/admin/integrations/mixradius/MixRadiusClient.tsx`

**Problem:** `clearCache` sets `isRefreshingRef.current = true` tapi tidak trigger re-fetch. Invoice count effect hanya fire saat `data` berubah.

**Fix:** Setelah set ref, panggil `fetchData(true)` yang akan mengubah `data` dan trigger invoice count effect.

---

### Task 19: Fix Laba Rugi — monthly breakdown/chart harus respect date filter

**Files:**
- Modify: `modules/integrations/services/MixRadiusProfitLossService.ts`

**Problem:** `fetchProfitReport` return full year, `addYearlyExpenses` query Jan-Dec. Summary cards sudah filtered tapi chart/table tidak.

**Fix:** Filter `monthlyMap` entries setelah populate, hanya return bulan yang masuk date range user.

---

### Task 20: Fix Akun PUT — tambah Zod validation

**Files:**
- Modify: `app/api/integrations/mixradius/accounts/[id]/route.ts`

**Problem:** PUT route pass body langsung ke service tanpa validasi. `mixRadiusConfigUpdateSchema` sudah ada tapi tidak dipakai.

**Fix:** Import dan apply `mixRadiusConfigUpdateSchema.safeParse(body)`.

---

### Task 21: Fix Akun DELETE — handle record not found

**Files:**
- Modify: `app/api/integrations/mixradius/accounts/[id]/route.ts`

**Problem:** Jika config tidak ada, Prisma throw P2025 → 500 error. Seharusnya 404.

**Fix:** Wrap delete call dengan try/catch, detect P2025 → return `ApiErrors.notFound()`.

---

### Task 22: Fix Pendapatan SummaryCards — tooltip formula display

**Files:**
- Modify: `app/admin/integrations/mixradius/income-period/components/SummaryCards.tsx`

**Problem:** Tooltip breakdown tampil "Profit - Fee Seller - Gateway - Expenses" tapi `profit` sudah minus fee seller. Formula display tidak match actual value.

**Fix:** Update tooltip untuk tidak tampilkan "- Fee Seller" karena sudah included di profit.

---

### Task 23: Fix Pengeluaran — RABView viewingRAB stale after status transition

**Files:**
- Modify: `app/admin/integrations/mixradius/expenses/ExpensesClient.tsx`

**Problem:** `viewingRAB` prop ke RABView di-set sekali saat open. Setelah `onRefresh` → list refresh tapi modal prop tetap stale.

**Fix:** Di `handleRABRevisionSaved`, juga update `viewingRAB` dari fresh data, atau close+reopen modal.

---

## Verification

- [ ] **Final typecheck:** `npx tsc --noEmit`
- [ ] **Final lint:** `npx eslint app/api/integrations/ modules/integrations/ app/admin/integrations/ --quiet`
- [ ] **Run tests:** `npm test -- --run --reporter=verbose 2>&1 | tail -20`
