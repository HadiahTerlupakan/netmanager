# Review: Halaman Admin Network MikroTik

**Tanggal Review:** 2026-05-06  
**URL:** http://localhost:3000/admin/network/mikrotik  
**Reviewer:** Claude (AI Code Review)

---

## Executive Summary

Halaman admin network MikroTik sudah mengikuti **Clean Architecture** dengan baik. Struktur kode terorganisir dengan pemisahan layer yang jelas (UI → API → Service → Repository). Namun ditemukan beberapa **code smell** dan pelanggaran best practices yang perlu diperbaiki.

**Status Arsitektur:** ✅ **SUDAH CLEAN ARCHITECTURE**  
**Kualitas Kode:** ⚠️ **PERLU PERBAIKAN** (Code Smell Detected)

---

## Struktur Arsitektur

### Layer Separation ✅

```
app/admin/network/mikrotik/page.tsx (UI Layer)
    ↓
app/api/mikrotik-routers/route.ts (Controller/API Layer)
    ↓
modules/network/services/MikroTikRouterService.ts (Service Layer)
    ↓
modules/network/repositories/MikroTikRouterRepository.ts (Repository Layer)
    ↓
Prisma Client (Database)
```

**Penilaian:** Dependency rule sudah benar, tidak ada layer yang melompati layer di bawahnya.

---

## Code Smell & Issues

### 1. ❌ **GOD COMPONENT** - `MikroTikRouterList.tsx`

**Lokasi:** `app/admin/network/mikrotik/MikroTikRouterList.tsx`

**Masalah:**
- Component ini melakukan terlalu banyak tanggung jawab:
  1. State management (data, loading, search, pagination)
  2. API calls (delete, test connection)
  3. Modal management (test modal, reconfigure modal)
  4. Real-time updates (Firebase)
  5. Rendering table

**Pelanggaran:** Single Responsibility Principle (SRP)

**Solusi:**
```typescript
// Pecah menjadi:
// 1. MikroTikRouterList.tsx - hanya orchestration
// 2. useMikrotikActions.ts - handle delete & test connection
// 3. useMikrotikModals.ts - handle modal state
// 4. MikrotikRouterTable.tsx - sudah ada, bagus
```

---

### 2. ❌ **DIRECT API CALLS IN COMPONENT**

**Lokasi:** `MikroTikRouterList.tsx:33-54` (handleDelete), `MikroTikRouterList.tsx:56-86` (handleTestConnection)

**Masalah:**
```typescript
// ❌ BAD: Business logic di component
const handleDelete = async (id: string, name: string) => {
  if (!confirm(`Apakah Anda yakin ingin menghapus router "${name}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/mikrotik-routers/${id}`, {
      method: "DELETE",
    });
    // ... error handling
  } catch (_error) {
    toast.error("Gagal menghapus router");
  }
};
```

**Pelanggaran:** 
- Component tidak boleh tahu detail API endpoint
- Error handling terlalu generic
- Confirm dialog di business logic

**Solusi:**
```typescript
// ✅ GOOD: Extract ke custom hook
// hooks/useMikrotikActions.ts
export function useMikrotikActions() {
  const deleteRouter = async (id: string, name: string) => {
    const confirmed = await confirmDialog({
      title: "Hapus Router",
      message: `Apakah Anda yakin ingin menghapus router "${name}"?`,
    });
    
    if (!confirmed) return { success: false };

    const result = await apiClient.delete(`/mikrotik-routers/${id}`);
    return result;
  };

  return { deleteRouter, testConnection };
}
```

---

### 3. ⚠️ **MAGIC NUMBERS**

**Lokasi:** `useMikrotikRouterList.ts:48`, `mikrotikRouterTable.tsx:100-103`

**Masalah:**
```typescript
// ❌ BAD: Magic numbers
const [limit, setLimit] = useState(10);

<option value={10}>10</option>
<option value={25}>25</option>
<option value={50}>50</option>
<option value={100}>100</option>
```

**Solusi:**
```typescript
// ✅ GOOD: Named constants
const PAGINATION_LIMITS = {
  DEFAULT: 10,
  OPTIONS: [10, 25, 50, 100] as const,
} as const;

const [limit, setLimit] = useState(PAGINATION_LIMITS.DEFAULT);
```

---

### 4. ⚠️ **INCONSISTENT ERROR HANDLING**

**Lokasi:** `MikroTikRouterList.tsx:74-82`

**Masalah:**
```typescript
// ❌ BAD: Inconsistent error handling
} catch (error) {
  const errorMessage =
    error instanceof Error ? error.message : "Terjadi kesalahan";
  clientLogger.error("Test connection error:", error);
  setTestResult({
    success: false,
    api: { success: false, message: "Error: " + errorMessage },
    message: "Terjadi kesalahan saat test koneksi",
  });
}
```

**Masalah:**
- Error message di-hardcode
- Tidak ada error code
- User melihat generic message

**Solusi:**
```typescript
// ✅ GOOD: Structured error handling
} catch (error) {
  const apiError = parseApiError(error);
  clientLogger.error("Test connection error:", apiError);
  
  setTestResult({
    success: false,
    api: { 
      success: false, 
      message: apiError.userMessage,
      code: apiError.code 
    },
    message: "Gagal test koneksi",
  });
  
  toast.error(apiError.userMessage);
}
```

---

### 5. ⚠️ **UNUSED PARAMETER PREFIX**

**Lokasi:** `MikroTikRouterList.tsx:51`

**Masalah:**
```typescript
// ❌ BAD: Underscore prefix untuk unused variable
} catch (_error) {
  toast.error("Gagal menghapus router");
}
```

**Solusi:**
```typescript
// ✅ GOOD: Proper error handling atau eslint-disable
} catch (error) {
  clientLogger.error("Delete router error:", error);
  toast.error("Gagal menghapus router");
}
```

---

### 6. ✅ **GOOD: Proper Type Safety**

**Lokasi:** `useMikrotikRouterList.ts:10-27`

**Penilaian:** Type definitions sudah lengkap dan proper:
```typescript
export type MikrotikRouterListItem = {
  id: string;
  name: string;
  ipAddress: string;
  timezone: string;
  description: string | null;
  pingStatus: string;
  userOnline: number;
  lastStatusCheck: Date | null;
};
```

---

### 7. ✅ **GOOD: Debounced Search**

**Lokasi:** `useMikrotikRouterList.ts:46`

**Penilaian:** Sudah menggunakan debounce untuk search, bagus untuk performance:
```typescript
const debouncedSearch = useDebounce(search, 500);
```

---

### 8. ✅ **GOOD: Real-time Updates**

**Lokasi:** `useMikrotikRouterList.ts:93-97`

**Penilaian:** Sudah menggunakan Firebase real-time untuk auto-refresh:
```typescript
useRealtimeScope({ kind: "admin", id: "mikrotik" });

useRealtimeEvent<MikroTikUpdateData>("mikrotik.update", () => {
  void fetchRouters();
});
```

---

### 9. ⚠️ **REPOSITORY: UPSERT LOGIC**

**Lokasi:** `MikroTikRouterRepository.ts:103-158`

**Masalah:**
```typescript
// ❌ QUESTIONABLE: Upsert pada create
const router = await this.client.mikroTikRouter.upsert({
  where: {
    tenantId_ipAddress: {
      tenantId: data.tenantId || "",
      ipAddress: data.ipAddress,
    },
  },
  update: { /* ... */ },
  create: { /* ... */ },
});
```

**Concern:**
- Create seharusnya fail jika IP sudah ada
- Upsert behavior bisa unexpected untuk user
- Tidak ada warning ke user bahwa data di-overwrite

**Rekomendasi:**
```typescript
// ✅ BETTER: Explicit create with conflict check
async create(data: MikroTikRouterCreateData): Promise<{ id: string }> {
  const existing = await this.findByIpAddress(data.ipAddress, data.tenantId);
  
  if (existing) {
    throw new RouterIpConflictError(
      `Router dengan IP ${data.ipAddress} sudah ada`
    );
  }

  const router = await this.client.mikroTikRouter.create({
    data: { /* ... */ }
  });

  await syncNasOnRouterCreate(this.radiusRepo, router, data.apiPort ?? 8728);
  return { id: router.id };
}
```

---

### 10. ⚠️ **API ROUTE: GENERIC ERROR MESSAGE**

**Lokasi:** `app/api/mikrotik-routers/route.ts:77-82`

**Masalah:**
```typescript
// ❌ BAD: Generic error message
return apiError(
  "IP Address sudah terpakai atau terjadi kesalahan",
  ErrorCodes.CONFLICT,
  { status: 409 },
);
```

**Masalah:**
- Message terlalu generic
- User tidak tahu error sebenarnya apa

**Solusi:**
```typescript
// ✅ GOOD: Specific error handling
} catch (error: unknown) {
  if (error instanceof RouterAccessDeniedError) {
    return ApiErrors.forbidden(error.message);
  }
  
  if (error instanceof RouterIpConflictError) {
    return apiError(
      `IP Address ${parsed.data.ipAddress} sudah digunakan`,
      ErrorCodes.CONFLICT,
      { status: 409 }
    );
  }

  clientLogger.error("Create router error:", error);
  return apiError(
    "Gagal membuat router",
    ErrorCodes.INTERNAL_ERROR,
    { status: 500 }
  );
}
```

---

### 11. ✅ **GOOD: Service Layer Separation**

**Lokasi:** `modules/network/services/MikroTikRouterService.ts`

**Penilaian:** Service layer sudah proper:
- Dependency injection via constructor
- Clear method responsibilities
- Proper delegation ke repository
- Access control via helper functions

```typescript
export class MikroTikRouterService {
  constructor(
    private readonly routerRepository: IMikroTikRouterRepository = new MikroTikRouterRepository(),
    private readonly networkRepository: IRouterAccessRepository = new NetworkRepository(),
    private readonly provisioningService = new MikroTikProvisioningService(),
  ) {}
  
  // Clear, focused methods
  async listRouters(params: {...}) { /* ... */ }
  async getRouterById(params: {...}) { /* ... */ }
  async createRouter(params: {...}) { /* ... */ }
}
```

---

### 12. ✅ **GOOD: Authorization Pattern**

**Lokasi:** `app/api/mikrotik-routers/route.ts:22-24`

**Penilaian:** Authorization sudah benar di API layer:
```typescript
if (!(await hasPermission("mikrotik:read"))) {
  return ApiErrors.forbidden("Akses ditolak");
}
```

---

## Performance Analysis

### ✅ **Optimizations Detected:**

1. **Debounced Search** - Mengurangi API calls saat user mengetik
2. **Pagination** - Tidak load semua data sekaligus
3. **Real-time Updates** - Hanya refresh saat ada perubahan
4. **Parallel Fetching** - `Promise.all` untuk fetch routers + settings

### ⚠️ **Potential Issues:**

1. **N+1 Query Risk** - Repository tidak menggunakan `include` untuk relations
2. **No Caching** - Setiap page change = new API call
3. **Modal Re-render** - Modal components selalu di-render meskipun tidak visible

---

## Security Analysis

### ✅ **Security Measures:**

1. **RBAC Enforcement** - Permission check di API layer
2. **Tenant Isolation** - `tenantId` filter di semua query
3. **Site Restriction** - Support untuk `restrictedToOwnSite`
4. **Input Validation** - Zod schema validation

### ⚠️ **Security Concerns:**

1. **Password Storage** - `apiPassword` disimpan plain text di database (perlu encryption)
2. **Confirm Dialog** - Native `confirm()` bisa di-bypass
3. **Error Messages** - Bisa leak information (e.g., "IP sudah terpakai")

---

## Testing Coverage

### ❌ **Missing Tests:**

Tidak ditemukan test files untuk:
- `MikroTikRouterList.tsx`
- `useMikrotikRouterList.ts`
- `MikroTikRouterService.ts`
- `MikroTikRouterRepository.ts`

**Rekomendasi:** Minimal 70% coverage untuk service layer, 90% untuk critical path.

---

## Recommendations

### 🔴 **HIGH PRIORITY:**

1. **Refactor MikroTikRouterList.tsx**
   - Extract API calls ke custom hooks
   - Separate modal management
   - Reduce component responsibility

2. **Fix Repository Upsert Logic**
   - Change `upsert` to explicit `create`
   - Add proper conflict error handling
   - Inform user when IP conflict occurs

3. **Add Password Encryption**
   - Encrypt `apiPassword` before storing
   - Decrypt only when needed for API connection

4. **Add Unit Tests**
   - Service layer: 70% coverage minimum
   - Repository layer: integration tests
   - API routes: request/response tests

### 🟡 **MEDIUM PRIORITY:**

5. **Extract Magic Numbers**
   - Create constants file for pagination limits
   - Create constants for API ports, timeouts

6. **Improve Error Handling**
   - Create error parser utility
   - Standardize error messages
   - Add error codes for client-side handling

7. **Add Caching**
   - Cache router list for 30 seconds
   - Invalidate on mutations
   - Use SWR or React Query

### 🟢 **LOW PRIORITY:**

8. **Optimize Modal Rendering**
   - Use lazy loading for modals
   - Only render when `open={true}`

9. **Add Loading States**
   - Skeleton loaders for table
   - Button loading states

10. **Improve Type Safety**
    - Replace `unknown` with specific error types
    - Add branded types for IDs

---

## Conclusion

**Overall Score:** 7/10

**Strengths:**
- ✅ Clean Architecture sudah diterapkan dengan baik
- ✅ Layer separation jelas dan konsisten
- ✅ Authorization dan tenant isolation proper
- ✅ Real-time updates sudah implemented
- ✅ Type safety sudah bagus

**Weaknesses:**
- ❌ God Component (MikroTikRouterList)
- ❌ Direct API calls di component
- ❌ Upsert logic yang questionable
- ❌ Missing tests
- ❌ Password tidak di-encrypt

**Next Steps:**
1. Refactor `MikroTikRouterList.tsx` → extract hooks
2. Fix repository `create` method → remove upsert
3. Add password encryption
4. Write unit tests untuk service layer

---

**Generated by:** Claude AI Code Review  
**Date:** 2026-05-06
