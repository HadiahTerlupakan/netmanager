# Audit dan Perbaikan Scope/Permission Leakage - 2026-05-08

## Summary

Total 10 commit untuk menutup kebocoran scope dan memperbaiki permission resource yang salah.

## Perbaikan yang Dilakukan

### 1. Menu Visibility (Commit: d7a5617b)
**Masalah:** Menu mitra tampil meskipun permission tidak diaktifkan di matriks role
**Penyebab:** `MITRA.LIST` di-map ke `list:read` padahal seharusnya `mitra:read`
**Solusi:** Tambahkan special mapping di `adminSidebarMenu.ts`:
```typescript
const specialMappings: Record<string, string> = {
  "MITRA.LIST": "mitra",
  "MITRA.WITHDRAWALS": "withdrawals",
  "INVESTORS.LIST": "investors",
};
```

### 2. Site/Department Scope Leakage - Mutations (Commit: 2c3f99c6, 8316338c)
**Masalah:** Admin bisa create/update/delete resource di luar scope site/department mereka
**Endpoint yang diperbaiki:**
- Invoice void: `app/api/admin/invoices/[id]/void/route.ts`
- Mitra list/create: `app/api/admin/mitra/route.ts`
- Mitra detail (GET/PUT/DELETE/PATCH): `app/api/admin/mitra/[id]/route.ts`

**Solusi:**
- Extract scope dengan `checkSiteRestriction()`
- Pass `allowedSiteIds` ke service layer
- Validasi scope sebelum mutasi di service/repository

### 3. Mitra Withdrawal Scope Leakage (Commit: 56ac98a6)
**Masalah:** Admin bisa view/process withdrawal untuk mitra di luar scope mereka
**Endpoint yang diperbaiki:**
- Withdrawal list: `app/api/admin/mitra/withdrawals/route.ts`
- Withdrawal actions: `app/api/admin/mitra/withdrawals/[id]/route.ts`

**Solusi:**
- Filter withdrawal list berdasarkan `allowedSiteIds`
- Validasi scope sebelum approve/reject/complete withdrawal

### 4. Permission Resource Misalignment (Commit: 45e70cbf, 02d2eec9)

#### Mitra Endpoints
**Masalah:** Mitra wallet dan face-verifications pakai `users:*` padahal seharusnya `mitra:*`
**Endpoint yang diperbaiki:**
- `app/api/admin/mitra/[id]/wallet/route.ts`: `users:read` → `mitra:read`, `users:update` → `mitra:update`
- `app/api/admin/mitra/[id]/face-verifications/route.ts`: `users:read` → `mitra:read`
- Tambahkan scope validation dengan `validateMitraAccess()` helper

#### Workorders Endpoints
**Masalah:** Semua workorders endpoint pakai `list:*` padahal seharusnya `workorders:*`
**Endpoint yang diperbaiki (11 files):**
- `list:read` → `workorders:read`
- `list:create` → `workorders:create`
- `list:update` → `workorders:update`
- `list:verify` → `workorders:verify`
- `list:cancel` → `workorders:cancel`
- `list:delete` → `workorders:delete`

#### Leave Endpoints
**Masalah:** Leave endpoint pakai `izin:*` (Indonesian) padahal route path adalah `/leaves` (English)
**Endpoint yang diperbaiki:**
- `app/api/admin/leaves/route.ts`: `izin:read` → `leave:read`, `izin:create` → `leave:create`
- `app/api/admin/leaves/[id]/route.ts`: `izin:verify` → `leave:verify`, `izin:delete` → `leave:delete`

#### Holidays Endpoints
**Masalah:** Holidays endpoint pakai singular `holiday:*` padahal route path adalah plural `/holidays`
**Endpoint yang diperbaiki:**
- `app/api/admin/holidays/route.ts`: `holiday:read` → `holidays:read`, `holiday:create` → `holidays:create`
- `app/api/admin/holidays/[id]/route.ts`: `holiday:update` → `holidays:update`, `holiday:delete` → `holidays:delete`

### 5. Site Dropdown Scope Bypass (Commit: 8db663c8)
**Masalah:** Dropdown site menampilkan semua site meskipun user restricted
**Solusi:** Filter site list berdasarkan `userSites` relation

## Arsitektur Pattern yang Digunakan

### Scope Validation Pattern
```typescript
// 1. Extract scope di route
const { isRestricted, siteIds } = checkSiteRestriction({ user } as never, 'resource')
const allowedSiteIds = isRestricted ? siteIds : undefined

// 2. Pass ke service
const result = await service.getItems({ ...filters, allowedSiteIds })

// 3. Filter di repository
where: {
  ...(allowedSiteIds && allowedSiteIds.length > 0 && {
    siteId: { in: allowedSiteIds }
  })
}
```

### Mutation Scope Validation Pattern
```typescript
// Untuk create/update yang mengubah siteId
if (isRestricted && body.siteId) {
  if (!siteIds.includes(body.siteId)) {
    return NextResponse.json(
      { success: false, error: "Tidak dapat mengubah resource ke site di luar scope" },
      { status: 403 }
    )
  }
}
```

### Detail Access Validation Pattern
```typescript
async function validateResourceAccess(
  resourceId: string,
  user: { id: string; name?: string | null }
): Promise<{ allowed: boolean; error?: string }> {
  const { isRestricted, siteIds } = checkSiteRestriction({ user } as never, 'resource')
  if (!isRestricted) return { allowed: true }

  const resource = await service.getById(resourceId)
  if (!resource.success) return { allowed: false, error: 'Resource tidak ditemukan' }

  if (!resource.data.siteId || !siteIds.includes(resource.data.siteId)) {
    return { allowed: false, error: 'Tidak dapat mengakses resource di luar scope' }
  }

  return { allowed: true }
}
```

## Files Modified

### Core Infrastructure
- `components/layout/admin-sidebar/adminSidebarMenu.ts` - Menu filtering
- `modules/roles/index.ts` - Scope restriction helpers

### API Routes (Total: 20+ files)
- Invoice: 1 file
- Mitra: 4 files
- Withdrawals: 2 files
- Workorders: 11 files
- Leave: 2 files
- Holidays: 2 files

### Service/Repository Layer
- `modules/finance/services/VoidInvoiceService.ts`
- `modules/mitra/services/MitraService.ts`
- `modules/mitra/services/MitraWithdrawService.ts`
- `modules/mitra/repositories/MitraRepository.helpers.ts`
- `modules/mitra/repositories/MitraWithdrawRepository.ts`
- `modules/mitra/dto/MitraDTO.ts`
- `modules/mitra/mappers/MitraMapper.ts`
- `modules/mitra/domain/ports/IMitraWithdrawRepository.ts`

## Testing

Semua perubahan sudah diverifikasi dengan:
- `npm run typecheck` - PASS
- Manual testing untuk scope validation
- Review permission matrix alignment

## Remaining Work

Berdasarkan audit subagent, masih ada beberapa endpoint dengan permission resource yang perlu direview (confidence: MEDIUM):

1. **Support Tickets**: `support:*` vs `support_tickets:*`
2. **Settings Email/WhatsApp**: Flat `email:*`/`whatsapp:*` vs nested `settings_email:*`/`settings_whatsapp:*`

Namun ini bisa jadi intentional design, perlu konfirmasi dengan user apakah perlu diubah.

## Conclusion

Kebocoran scope dan permission mismatch sudah ditutup untuk:
- ✅ Menu visibility
- ✅ Site/department scope untuk mutations
- ✅ Mitra endpoints (list, detail, wallet, face-verifications, withdrawals)
- ✅ Invoice void
- ✅ Workorders endpoints (semua 11 files)
- ✅ Leave endpoints
- ✅ Holidays endpoints
- ✅ Site dropdown

Permission resource sekarang konsisten dengan:
- Route path naming (workorders, leave, holidays)
- Domain resource naming (mitra, withdrawals)
- Menu matrix configuration

---

*Generated: 2026-05-08*
*Total Commits: 10*
*Total Files Modified: 30+*
