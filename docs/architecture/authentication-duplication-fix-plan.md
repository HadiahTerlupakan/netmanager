# 🚨 Rencana Perbaikan Duplikasi Autentikasi

## Masalah yang Ditemukan

### 1. Multiple Fungsi `requireAdmin` yang Duplikat
Ditemukan **60+ implementasi fungsi `requireAdmin`** yang duplikat di berbagai file API:
- `app/api/olts/[id]/route.ts`
- `app/api/inventory/*/route.ts`
- `app/api/mikrotik-routers/*/route.ts`
- `app/api/admin/*/route.ts`
- Dan banyak lagi...

### 2. Multiple Fungsi `requireAuth` yang Duplikat
Ditemukan **6+ implementasi fungsi `requireAuth`** yang duplikat di:
- `app/api/inventory/upload-photo/route.ts`
- `app/api/inventory/masuk/route.ts`
- `app/api/inventory/returns/route.ts`
- `app/api/inventory/returns/[id]/route.ts`
- `app/api/inventory/barang/stock/by-kondisi/route.ts`
- `app/api/inventory/returns/upload-photo/route.ts`

### 3. Inkonsistensi Implementasi
- Beberapa fungsi menggunakan `getServerSession(authConfig as any)`
- Beberapa menggunakan `verifyAuth()` dari `lib/auth.ts`
- Beberapa menggunakan `verifySession()` dari `lib/route-protection.ts`

### 4. Konfigurasi Autentikasi Tersebar
- Ada `authConfig` di `lib/auth.ts`
- Ada `authOptions` yang sama-sama export dari file yang sama
- Ada `verifyAuth` dan `verifySession` dengan implementasi berbeda

## 📋 Solusi yang Diusulkan

### Langkah 1: Buat Fungsi Autentikasi Terpusat

Buat file `lib/auth-helpers.ts` dengan fungsi-fungsi terpusat:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

/**
 * Fungsi autentikasi terpusat untuk memeriksa session user
 */
export async function getCurrentSession(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig as any)
    return session
  } catch (error) {
    console.error('[AUTH] Error getting session:', error)
    return null
  }
}

/**
 * Fungsi requireAuth yang terpusat
 */
export async function requireAuth(request: NextRequest) {
  const session = await getCurrentSession(request)
  
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return null // Allow request to proceed
}

/**
 * Fungsi requireAdmin yang terpusat
 */
export async function requireAdmin(request: NextRequest) {
  const session = await getCurrentSession(request)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return null // Allow request to proceed
}

/**
 * Fungsi requireAdminOrEmployee untuk routes yang bisa diakses admin dan employee
 */
export async function requireAdminOrEmployee(request: NextRequest) {
  const session: any = await getCurrentSession(request)
  
  if (!session || !['ADMIN', 'EMPLOYEE'].includes(session?.user?.role)) {
    return NextResponse.json(
      { error: 'Admin or Employee access required' },
      { status: 401 }
    )
  }

  return null // Allow request to proceed
}

/**
 * Fungsi untuk self-access (user bisa akses data sendiri)
 */
export async function requireSelfAccess(request: NextRequest, resourceId: string) {
  const session: any = await getCurrentSession(request)
  
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  const userId = session.user.id

  // If trying to access someone else's data
  if (resourceId !== userId) {
    return NextResponse.json(
      { error: 'Cannot access other users\' data' },
      { status: 403 }
    )
  }

  return null // Allow request to proceed
}

/**
 * Helper functions tambahan
 */
export async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const session: any = await getCurrentSession(request)
  return session?.user?.id || null
}

export async function getCurrentEmployee(request: NextRequest) {
  const session: any = await getCurrentSession(request)
  return session?.user?.employee || null
}

export async function isAdmin(request: NextRequest): Promise<boolean> {
  const session: any = await getCurrentSession(request)
  return session?.user?.role === 'ADMIN'
}

export async function isEmployee(request: NextRequest): Promise<boolean> {
  const session: any = await getCurrentSession(request)
  return session?.user?.role === 'EMPLOYEE'
}
```

### Langkah 2: Refactor Semua API Routes

Ganti semua fungsi duplikat dengan import dari `lib/auth-helpers.ts`:

**Contoh perubahan untuk `requireAdmin`:**

**SEBELUM:**
```typescript
// Di setiap file API
async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

// Penggunaan
const session = await requireAdmin()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

**SETELAH:**
```typescript
// Import di bagian atas file
import { requireAdmin } from '@/lib/auth-helpers'

// Penggunaan langsung
const authError = await requireAdmin(request)
if (authError) return authError
```

### Langkah 3: Daftar File yang Perlu Di-refactor

#### Files dengan `requireAdmin` duplikat (60+ files):
- `app/api/olts/[id]/route.ts`
- `app/api/olts/route.ts`
- `app/api/olts/[id]/sync/route.ts`
- `app/api/olts/[id]/cards/route.ts`
- `app/api/olts/test-connection/route.ts`
- `app/api/olts/[id]/vlans/route.ts`
- `app/api/olts/[id]/onutypes/sync/route.ts`
- `app/api/olts/[id]/unconfigured-onus/route.ts`
- `app/api/joinboxes/[id]/route.ts`
- `app/api/joinboxes/route.ts`
- `app/api/odcs/route.ts`
- `app/api/odcs/[id]/route.ts`
- `app/api/inventory/analytics/usage/route.ts`
- `app/api/inventory/masuk/[id]/route.ts`
- `app/api/inventory/restock/alerts/route.ts`
- `app/api/inventory/barang/route.ts`
- `app/api/inventory/barang/stock/route.ts`
- `app/api/inventory/restock/prediction/route.ts`
- `app/api/inventory/barang/[id]/route.ts`
- `app/api/inventory/transfer/route.ts`
- `app/api/inventory/restock/settings/route.ts`
- `app/api/inventory/transfer/[id]/route.ts`
- `app/api/inventory/opname/summary/route.ts`
- `app/api/inventory/gudang/[id]/route.ts`
- `app/api/inventory/opname/[id]/route.ts`
- `app/api/inventory/opname/route.ts`
- `app/api/inventory/gudang/route.ts`
- `app/api/inventory/opname/list/route.ts`
- `app/api/inventory/keluar/[id]/route.ts`
- `app/api/inventory/opname/calculate/route.ts`
- `app/api/otbs/[id]/route.ts`
- `app/api/otbs/route.ts`
- `app/api/poles/[id]/route.ts`
- `app/api/mikrotik-routers/[id]/route.ts`
- `app/api/mikrotik-routers/check-status/route.ts`
- `app/api/poles/route.ts`
- `app/api/mikrotik-routers/route.ts`
- `app/api/mikrotik-routers/test-connection/route.ts`
- `app/api/network/alerts/[id]/route.ts`
- `app/api/network/performance/route.ts`
- `app/api/ftth/topology/route.ts`
- `app/api/network/performance/[id]/history/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/network/backups/[id]/restore/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/network/backups/[id]/route.ts`
- `app/api/network/backups/route.ts`
- `app/api/network/alerts/route.ts`
- `app/api/network/performance/[id]/route.ts`
- `app/api/speedprofiles/[id]/route.ts`
- `app/api/speedprofiles/route.ts`
- `app/api/onutypes/[id]/route.ts`
- `app/api/onutypes/route.ts`
- `app/api/onutypes/olt/[oltId]/route.ts`
- `app/api/speedprofiles/olt/[oltId]/route.ts`
- `app/api/odps/[id]/route.ts`
- `app/api/kmz/[id]/route.ts`
- `app/api/odps/route.ts`
- `app/api/kmz/route.ts`

#### Files dengan `requireAuth` duplikat (6+ files):
- `app/api/inventory/upload-photo/route.ts`
- `app/api/inventory/masuk/route.ts`
- `app/api/inventory/returns/route.ts`
- `app/api/inventory/returns/[id]/route.ts`
- `app/api/inventory/barang/stock/by-kondisi/route.ts`
- `app/api/inventory/returns/upload-photo/route.ts`

#### File dengan `requireAdminOrEmployee`:
- `app/api/inventory/keluar/route.ts`

### Langkah 4: Template Refactor

Untuk setiap file, lakukan perubahan berikut:

1. **Tambah import di bagian atas:**
```typescript
import { requireAdmin } from '@/lib/auth-helpers'
// atau
import { requireAuth } from '@/lib/auth-helpers'
// atau
import { requireAdminOrEmployee } from '@/lib/auth-helpers'
```

2. **Hapus fungsi duplikat:**
```typescript
// Hapus ini
async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}
```

3. **Update penggunaan:**
```typescript
// SEBELUM
const session = await requireAdmin()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// SETELAH
const authError = await requireAdmin(request)
if (authError) return authError
```

### Langkah 5: Cleanup

Setelah semua file di-refactor:

1. **Hapus fungsi duplikat dari `lib/route-protection.ts`** jika tidak digunakan lagi
2. **Konsolidasikan `verifyAuth` dan `verifySession`** ke satu fungsi yang konsisten
3. **Update `lib/auth.ts`** untuk menggunakan helper functions yang baru

### Langkah 6: Testing

1. **Test semua endpoint autentikasi** untuk memastikan tidak ada yang rusak
2. **Test berbagai role** (admin, employee, dll)
3. **Test error handling** untuk unauthorized access
4. **Test rate limiting** masih berfungsi

## 🎯 Manfaat Setelah Perbaikan

1. **Kode Lebih Bersih:** Tidak ada duplikasi fungsi autentikasi
2. **Maintenance Lebih Mudah:** Perubahan logic autentikasi hanya perlu dilakukan di satu tempat
3. **Konsistensi:** Semua API routes menggunakan logic autentikasi yang sama
4. **Security Lebih Baik:** Centralized security logging dan error handling
5. **Performance:** Mengurangi ukuran kode dan memuat fungsi yang sama berulang kali

## 🚀 Implementasi Priority

**High Priority (Immediate):**
- Buat `lib/auth-helpers.ts`
- Refactor 10 most used API routes
- Test basic functionality

**Medium Priority (Next Sprint):**
- Refactor remaining API routes
- Cleanup unused functions
- Comprehensive testing

**Low Priority (Future):**
- Add more sophisticated role-based access control
- Implement session timeout handling
- Add audit logging for security events

## 📝 Checklist Implementasi

- [ ] Buat file `lib/auth-helpers.ts` dengan fungsi terpusat
- [ ] Identifikasi 10 API routes yang paling sering digunakan
- [ ] Refactor 10 routes tersebut sebagai proof of concept
- [ ] Test semua 10 routes untuk memastikan berfungsi
- [ ] Buat script otomatis untuk refactor remaining routes
- [ ] Jalankan script untuk refactor 50+ remaining files
- [ ] Test semua API routes setelah refactor
- [ ] Cleanup fungsi duplikat yang tidak digunakan lagi
- [ ] Update documentation
- [ ] Deploy ke staging environment untuk final testing

## ⚠️ Risks dan Mitigasi

**Risk 1: Breaking Changes**
- Mitigasi: Test thoroughly di development environment
- Rollback plan: Keep backup of original files

**Risk 2: Performance Impact**
- Mitigasi: Benchmark sebelum dan sesudah perubahan
- Monitor: Watch API response times

**Risk 3: Security Issues**
- Mitigasi: Security review setelah refactor
- Test: Penetration testing untuk autentikasi endpoints

---

*Catatan: Rencana ini harus dieksekusi dalam mode Code karena melibatkan perubahan file TypeScript.*