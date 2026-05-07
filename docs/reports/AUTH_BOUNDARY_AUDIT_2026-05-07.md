# Auth Boundary Audit Report

**Tanggal:** 2026-05-07
**Scope:** 6 file auth-related di `/lib`

---

## Executive Summary

Setelah audit mendalam terhadap 6 file auth-related, ditemukan **overlap responsibility** dan **boundary yang kurang jelas** antara beberapa file. Namun, secara keseluruhan struktur sudah cukup baik dengan pembagian actor yang jelas.

**Status:** 🟡 **MODERATE** - Perlu klarifikasi boundary dan cleanup minor

---

## File-by-File Analysis

### 1. `lib/auth.ts` ✅ **GOOD** (Sudah Refactored)

**Responsibility:** NextAuth configuration & core auth utilities

**Status:** Sudah dipecah menjadi modular structure di `lib/auth/`:
- `config.ts` - NextAuth config
- `cookies.ts` - Cookie definitions
- `callbacks.ts` - JWT & session callbacks
- `permissions.ts` - Permission caching
- `helpers.ts` - Auth helper functions
- `session.ts` - Session cache helpers

**Boundary:** ✅ Jelas - Core authentication untuk web admin/employee via NextAuth

---

### 2. `lib/auth-helpers.ts` ⚠️ **OVERLAP dengan lib/auth**

**Responsibility:** Helper functions untuk authentication di API routes

**Isi:**
- `getCurrentSession()` - Get session via NextAuth
- `requireAuth()` - Auth guard untuk API routes
- `requireAdmin()` - Admin auth guard
- `requireSelfAccess()` - Self-access check
- `getCurrentUserId()`, `getCurrentEmployee()`, `isAdmin()`
- `isSuperAdminRole()` - Role checker

**Masalah:**
1. **Overlap dengan `lib/auth/helpers.ts`**
   - `isSuperAdminRole()` vs `isSuperAdmin()` - fungsi serupa
   - `getCurrentSession()` vs session helpers di `lib/auth/session.ts`
   
2. **Pola lama** - masih menggunakan manual auth guard pattern
   - `requireAuth()`, `requireAdmin()` sudah digantikan oleh `createHandler({ auth: true })`
   - File ini seharusnya deprecated untuk API routes baru

**Rekomendasi:**
- **DEPRECATE** untuk API routes - gunakan `createHandler` pattern
- **KEEP** hanya untuk backward compatibility route lama yang belum migrasi
- **MERGE** `isSuperAdminRole()` ke `lib/auth/helpers.ts`

---

### 3. `lib/server-auth.ts` ✅ **GOOD**

**Responsibility:** Server-side auth guards untuk Next.js Server Components (Pages)

**Isi:**
- `ensureEmployeeAccess()` - Guard untuk employee pages
- `ensureAdminAccess()` - Guard untuk admin pages
- `ensureAdminDashboardAccess()` - Guard untuk admin dashboard

**Boundary:** ✅ Jelas - Server Component auth guards (bukan API routes)

**Catatan:**
- Fungsi ini untuk **pages** (Server Components), bukan API routes
- Menggunakan `redirect()` untuk unauthorized access
- Sudah menggunakan `getUserPermissions()` dari `lib/auth`

**Status:** ✅ Tidak perlu perubahan - boundary sudah jelas

---

### 4. `lib/customer-auth.ts` ✅ **GOOD**

**Responsibility:** Customer portal authentication (JWT-based, bukan NextAuth)

**Isi:**
- `getCustomerSession()` - Get customer session dari JWT token
- `getCustomerSessionFromCookies()` - Get customer session dari cookies
- `requireCustomerPageAuth()` - Guard untuk customer pages
- `requireCustomerAuth()` - Guard untuk customer API routes
- `setCustomerAuthCookies()`, `clearCustomerAuthCookies()`
- `refreshCustomerToken()` - Token refresh logic

**Boundary:** ✅ Jelas - Customer portal auth (separate dari admin/employee)

**Catatan:**
- Menggunakan JWT token custom (bukan NextAuth)
- Cookie-based untuk web, Bearer token untuk mobile
- Sudah sesuai dengan rekomendasi review report: "Pertahankan fungsi session helper yang relevan"

**Status:** ✅ Tidak perlu perubahan - boundary sudah jelas

---

### 5. `lib/hybrid-auth.ts` ✅ **GOOD**

**Responsibility:** Unified auth untuk API routes yang support mobile + web

**Isi:**
- `getHybridUser()` - Try mobile Bearer token first, fallback to NextAuth session

**Boundary:** ✅ Jelas - Hybrid auth untuk API routes yang diakses mobile + web

**Use Case:**
- API routes yang diakses dari mobile app (Bearer token) DAN web admin (session cookie)
- Contoh: `/api/attendance/*`, `/api/work-order/*`

**Status:** ✅ Tidak perlu perubahan - boundary sudah jelas

---

### 6. `lib/mobile-auth.ts` ✅ **GOOD**

**Responsibility:** Mobile app authentication (JWT-based)

**Isi:**
- `signMobileToken()`, `signMobileRefreshToken()` - Generate JWT untuk mobile
- `verifyMobileToken()`, `verifyMobileRefreshToken()` - Verify JWT mobile
- `getMobileTokenDetails()` - Parse token + version check
- `hasMobilePermission()`, `hasAnyMobilePermission()` - Permission helpers
- `getMitraMobileFeatures()`, `getMitraMobileCapabilities()` - Mitra-specific logic

**Boundary:** ✅ Jelas - Mobile app auth (Employee, Customer, Mitra)

**Catatan:**
- Support 3 actor: Employee (User), Customer (Pelanggan), Mitra
- Include app version validation
- Token version check untuk force logout

**Status:** ✅ Tidak perlu perubahan - boundary sudah jelas

---

## Boundary Map (Current State)

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   WEB ADMIN  │  │  WEB CUSTOMER│  │  MOBILE APP  │      │
│  │  / EMPLOYEE  │  │    PORTAL    │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  lib/auth/*  │  │customer-auth │  │ mobile-auth  │      │
│  │  (NextAuth)  │  │   (JWT)      │  │   (JWT)      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                            ▼                                 │
│                   ┌────────────────┐                         │
│                   │  hybrid-auth   │                         │
│                   │ (Unified API)  │                         │
│                   └────────────────┘                         │
│                                                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   AUTHORIZATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   API Routes     │  │  Server Pages    │                 │
│  └────────┬─────────┘  └────────┬─────────┘                 │
│           │                      │                           │
│           ▼                      ▼                           │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │  createHandler   │  │  server-auth.ts  │                 │
│  │  (New Pattern)   │  │  (Page Guards)   │                 │
│  └────────┬─────────┘  └──────────────────┘                 │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────────────────┐                           │
│  │ authorization-middleware.ts  │                           │
│  │  (Permission Evaluation)     │                           │
│  └──────────────────────────────┘                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Issues & Recommendations

### Issue 1: `lib/auth-helpers.ts` Overlap ⚠️

**Problem:**
- Overlap dengan `lib/auth/helpers.ts`
- Pola lama yang sudah digantikan `createHandler`

**Recommendation:**
1. **Deprecate** `requireAuth()`, `requireAdmin()` untuk route baru
2. **Merge** `isSuperAdminRole()` ke `lib/auth/helpers.ts`
3. **Keep** file ini hanya untuk backward compatibility route lama
4. **Add deprecation comment** di top file

**Priority:** Medium

---

### Issue 2: Naming Inconsistency

**Problem:**
- `isSuperAdminRole()` di `auth-helpers.ts`
- `isSuperAdmin()` di `lib/auth/helpers.ts`
- `isSuperAdminUser()` di `lib/auth/helpers.ts`

**Recommendation:**
- Standardize ke `isSuperAdmin()` sebagai public API
- `isSuperAdminUser()` tetap ada untuk type-specific check

**Priority:** Low

---

## Action Items

### Priority 1 (High) - DONE ✅
1. ✅ Refactor `lib/auth.ts` - COMPLETED
2. ✅ Refactor `lib/authorization-middleware.ts` - COMPLETED

### Priority 2 (Medium) - RECOMMENDED
3. **Deprecate `lib/auth-helpers.ts` untuk route baru**
   - Add deprecation comment
   - Update documentation
   - Merge `isSuperAdminRole()` ke `lib/auth/helpers.ts`

### Priority 3 (Low) - OPTIONAL
4. **Standardize naming** - `isSuperAdmin()` sebagai primary API

---

## Conclusion

Auth boundary sudah **cukup jelas** dengan pembagian:
- **Web Admin/Employee** → `lib/auth/*` (NextAuth)
- **Customer Portal** → `lib/customer-auth.ts` (JWT)
- **Mobile App** → `lib/mobile-auth.ts` (JWT)
- **Hybrid API** → `lib/hybrid-auth.ts` (Unified)
- **Page Guards** → `lib/server-auth.ts` (Server Components)

**Main Issue:** `lib/auth-helpers.ts` adalah pola lama yang overlap dengan `createHandler` pattern. Perlu deprecation untuk route baru, tapi keep untuk backward compatibility.

**Overall Status:** 🟢 **GOOD** - Boundary jelas, hanya perlu cleanup minor

---

*Generated by Claude Code Review System*
*Last Updated: 2026-05-07*
