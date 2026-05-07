# Button Refactor Audit Report

**Tanggal:** 2026-05-06  
**Total Scan:** 108 lokasi dengan bg-indigo-600/dark:bg-indigo-500

## Kategori Hasil Audit

### ✅ AMAN REFACTOR (70+ file)
Button standar dengan pola `bg-indigo-600 hover:bg-indigo-700` yang bisa langsung diganti ke `<Button variant="default">` atau `buttonVariants({ variant: "default" })`

**Area prioritas:**
- Admin users management (5 files)
- Admin pengaturan (10 files)
- Admin paket (6 files)
- Admin tenants (2 files)
- Admin inventory (3 files)
- Admin workorders (8 files)
- Admin pelanggan/ppp (8 files)
- Admin marketing (3 files)
- Admin finance (2 files)
- Admin salary (3 files)
- Admin integrations (6 files)
- Components shared (3 files)
- Error pages (3 files)

### ⚠️ PERLU HANDLING KHUSUS (10 files)

**Red Flag Files:**
1. `/app/mitra-id/[id]/IdCardClient.tsx` - rounded-full + shadow-xl + active:bg-indigo-800
2. `/app/admin/inventory/restock/*` (3 files) - font-black + uppercase + custom scale animation
3. `/app/admin/users/compare/UsersCompareClient.tsx` - Tab selector dengan conditional state
4. `/app/admin/workorders/[id]/components/WoDiscussionTab.tsx` - Scale animation hover/active
5. `/app/admin/integrations/mixradius/expenses/RABForm.tsx` - Complex conditional styling

**Rekomendasi:** Review manual case-by-case, mungkin perlu variant baru atau tetap manual

### 🚫 SKIP - BUKAN BUTTON (23 lokasi)

**Kategori exclude:**
- Toggle switch (7 files) - `peer-checked:bg-indigo-600`
- Progress bar (2 files) - Upload/loading indicator
- Badge/indicator (3 files) - Status badge
- Tab indicator (1 file) - Active tab underline
- Banner/decoration (2 files) - Background decoration

## Strategi Refactor

### Phase 1: Quick Wins (DONE)
- ✅ Global button dark mode fix di `components/ui/Button.tsx`
- ✅ Admin users area (UserList.tsx, UserTable.tsx)
- ✅ ComparisonBar.tsx

### Phase 2: Batch Refactor (IN PROGRESS)
Target: 70+ file aman refactor

**Pattern replacement:**
```tsx
// Before
className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors"

// After
import { buttonVariants } from "@/components/ui/Button"
className={buttonVariants({ variant: "default" })}
```

**Cleanup:**
- Remove redundant: `text-white`, `w-5 h-5 text-white` pada icon
- Keep necessary: layout classes, custom spacing jika ada

### Phase 3: Special Cases
Handle 10 file red flag secara individual

### Phase 4: Validation
- TypeScript type check
- E2E test critical paths
- Visual spot check light/dark mode

## Progress Tracking

**Completed:**
- [x] Global button dark mode styling
- [x] Admin users area (2 files)
- [ ] Admin pengaturan (0/10)
- [ ] Admin paket (0/6)
- [ ] Admin tenants (0/2)
- [ ] Admin inventory (0/3)
- [ ] Admin workorders (0/8)
- [ ] Admin pelanggan (0/8)
- [ ] Admin marketing (0/3)
- [ ] Admin finance (0/2)
- [ ] Admin salary (0/3)
- [ ] Admin integrations (0/6)
- [ ] Components shared (0/3)
- [ ] Error pages (0/3)

**Total Progress:** 2/70+ files (3%)

## Estimasi

- **Aman refactor:** ~2-3 menit per file × 70 = 140-210 menit
- **Red flag handling:** ~10-15 menit per file × 10 = 100-150 menit
- **Testing & validation:** ~30 menit
- **Total:** ~4-6 jam kerja

## Next Steps

1. Batch refactor admin pengaturan area (10 files)
2. Batch refactor admin paket area (6 files)
3. Continue dengan area lain berdasarkan prioritas
4. Handle red flag files di akhir
5. Full validation & testing
